-- Follow-up hardening for application-email delivery requests and bounded retries.
-- Keep the original migration immutable and preserve historical fourth-attempt audit rows.

alter table public.applications
  add column if not exists email_delivery_requested_at timestamptz,
  add column if not exists email_delivery_recovery_completed_at timestamptz;

alter table public.email_logs
  add column if not exists provider_accepted_at timestamptz;

create index if not exists applications_email_delivery_recovery_idx
  on public.applications(id)
  where email_delivery_requested_at is not null
    and email_delivery_recovery_completed_at is null;

create or replace function public.enqueue_application_email_deliveries(
  p_application_id uuid,
  p_company_id uuid,
  p_applicant_email text,
  p_admin_email text,
  p_from_email text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.email_logs (
    application_id, company_id, provider, from_email, to_email, subject,
    template_key, delivery_key, recipient_role, status, next_attempt_at
  )
  select p_application_id, p_company_id, 'resend', p_from_email,
    case role when 'applicant' then p_applicant_email when 'admin' then p_admin_email else null end,
    'Jelentkezési e-mail előkészítése',
    case role when 'applicant' then 'application_confirmation' when 'admin' then 'application_notification_admin' else 'application_notification_partner' end,
    'application_email:' || role || ':' || p_application_id::text,
    role, 'queued'::public.email_log_status, now()
  from unnest(array['applicant', 'admin', 'partner']) as role
  where not exists (
    select 1 from public.email_logs existing
    where existing.delivery_key = 'application_email:' || role || ':' || p_application_id::text
  )
  on conflict (delivery_key) where delivery_key is not null do nothing;

  update public.applications
  set email_delivery_requested_at = coalesce(email_delivery_requested_at, now()),
      email_delivery_recovery_completed_at = now()
  where id = p_application_id
    and not exists (
      select 1 from unnest(array['applicant', 'admin', 'partner']) missing_role
      where not exists (
        select 1 from public.email_logs logs
        where logs.delivery_key = 'application_email:' || missing_role || ':' || p_application_id::text
      )
    );
  return true;
end;
$$;

-- Replace the old signature instead of leaving an ambiguous overload with defaults.
revoke all on function public.claim_due_application_email_deliveries(uuid, integer, uuid) from public;
drop function if exists public.claim_due_application_email_deliveries(uuid, integer, uuid);
create or replace function public.claim_due_application_email_deliveries(
  p_worker_id uuid,
  p_limit integer default 20,
  p_application_id uuid default null,
  p_admin_email text default null,
  p_from_email text default ''
)
returns table (
  id uuid,
  application_id uuid,
  company_id uuid,
  recipient_role text,
  delivery_key text,
  attempt_count integer,
  worker_id uuid,
  provider_uncertain_since timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only open recovery markers are scanned, and only genuinely missing roles are inserted.
  insert into public.email_logs (
    application_id, company_id, provider, from_email, to_email, subject,
    template_key, delivery_key, recipient_role, status, next_attempt_at
  )
  select applications.id, jobs.company_id, 'resend', p_from_email,
    case role when 'applicant' then applications.applicant_email when 'admin' then p_admin_email else null end,
    'Jelentkezési e-mail előkészítése',
    case role when 'applicant' then 'application_confirmation' when 'admin' then 'application_notification_admin' else 'application_notification_partner' end,
    'application_email:' || role || ':' || applications.id::text,
    role, 'queued'::public.email_log_status, now()
  from public.applications
  join public.jobs on jobs.id = applications.job_id
  cross join unnest(array['applicant', 'admin', 'partner']) as role
  where applications.email_delivery_requested_at is not null
    and applications.email_delivery_recovery_completed_at is null
    and (p_application_id is null or applications.id = p_application_id)
    and not exists (
      select 1 from public.email_logs existing
      where existing.delivery_key = 'application_email:' || role || ':' || applications.id::text
    )
  on conflict (delivery_key) where delivery_key is not null do nothing;

  update public.applications applications
  set email_delivery_recovery_completed_at = now()
  where applications.email_delivery_requested_at is not null
    and applications.email_delivery_recovery_completed_at is null
    and (p_application_id is null or applications.id = p_application_id)
    and not exists (
      select 1 from unnest(array['applicant', 'admin', 'partner']) missing_role
      where not exists (
        select 1 from public.email_logs logs
        where logs.delivery_key = 'application_email:' || missing_role || ':' || applications.id::text
      )
    );

  -- A provider-accepted or abandoned in-flight request older than Resend's
  -- 24-hour idempotency window must never be sent automatically again.
  update public.email_logs logs
  set status = 'failed', next_attempt_at = null, locked_at = null, locked_by = null,
      error_code = 'manual_review_required',
      error_message = 'A szolgáltatói átvétel 24 órán túl nem igazolható; kézi ellenőrzés szükséges.'
  where logs.status = 'queued'
    and logs.last_attempt_at <= now() - interval '24 hours'
    and logs.application_id is not null
    and (p_application_id is null or logs.application_id = p_application_id)
    and (
      logs.error_code = 'provider_success_unconfirmed'
      or exists (
        select 1 from public.email_delivery_attempts attempts
        where attempts.email_log_id = logs.id
          and attempts.attempt_number = logs.attempt_count
          and attempts.status = 'started'
          and attempts.completed_at is null
      )
    );

  return query
  with candidates as (
    select logs.id,
      case when logs.error_code = 'provider_success_unconfirmed' or exists (
        select 1 from public.email_delivery_attempts attempts
        where attempts.email_log_id = logs.id
          and attempts.attempt_number = logs.attempt_count
          and attempts.status = 'started'
          and attempts.completed_at is null
      ) then coalesce(logs.provider_accepted_at, logs.last_attempt_at) else null end as provider_uncertain_since
    from public.email_logs as logs
    where logs.status = 'queued'
      and logs.next_attempt_at is not null
      and logs.next_attempt_at <= now()
      and logs.attempt_count < 3
      and logs.application_id is not null
      and logs.recipient_role in ('applicant', 'admin', 'partner')
      and (p_application_id is null or logs.application_id = p_application_id)
      and (logs.locked_at is null or logs.locked_at < now() - interval '10 minutes')
    order by logs.next_attempt_at, logs.created_at
    for update of logs skip locked
    limit greatest(1, least(p_limit, 100))
  ), claimed as (
    update public.email_logs as logs
    set attempt_count = logs.attempt_count + 1,
        last_attempt_at = now(), next_attempt_at = null,
        locked_at = now(), locked_by = p_worker_id,
        error_code = null, error_message = null
    from candidates
    where logs.id = candidates.id
    returning logs.id, logs.application_id, logs.company_id, logs.recipient_role,
      logs.delivery_key, logs.attempt_count, logs.locked_by, candidates.provider_uncertain_since
  ), attempts as (
    insert into public.email_delivery_attempts (email_log_id, attempt_number, status)
    select claimed.id, claimed.attempt_count, 'started' from claimed
    returning email_log_id
  )
  select claimed.id, claimed.application_id, claimed.company_id, claimed.recipient_role,
    claimed.delivery_key, claimed.attempt_count, claimed.locked_by, claimed.provider_uncertain_since
  from claimed join attempts on attempts.email_log_id = claimed.id;
end;
$$;

-- Extend completion with the provider-acceptance timestamp used for the 24-hour safety boundary.
revoke all on function public.complete_application_email_delivery(uuid, uuid, public.email_log_status, text, text, text, timestamptz) from public;
drop function if exists public.complete_application_email_delivery(uuid, uuid, public.email_log_status, text, text, text, timestamptz);
create or replace function public.complete_application_email_delivery(
  p_email_log_id uuid, p_worker_id uuid, p_status public.email_log_status,
  p_provider_message_id text default null, p_error_code text default null,
  p_error_message text default null, p_next_attempt_at timestamptz default null,
  p_provider_accepted_at timestamptz default null
)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_attempt_count integer;
begin
  if p_status not in ('queued', 'sent', 'failed') then raise exception 'Unsupported email delivery status'; end if;
  update public.email_logs
  set status = p_status,
      provider_message_id = case when p_status = 'sent' then p_provider_message_id else provider_message_id end,
      provider_accepted_at = case
        when p_status = 'sent' then coalesce(p_provider_accepted_at, provider_accepted_at, now())
        when p_error_code = 'provider_success_unconfirmed' then coalesce(provider_accepted_at, p_provider_accepted_at, now())
        else provider_accepted_at end,
      sent_at = case when p_status = 'sent' then now() else sent_at end,
      next_attempt_at = case when p_status = 'queued' then p_next_attempt_at else null end,
      error_code = p_error_code, error_message = left(p_error_message, 500),
      locked_at = null, locked_by = null
  where id = p_email_log_id and locked_by = p_worker_id
  returning attempt_count into v_attempt_count;
  if v_attempt_count is null then return false; end if;
  update public.email_delivery_attempts
  set status = case p_status when 'sent' then 'sent' when 'queued' then 'retry_scheduled' else 'failed' end,
      completed_at = now(), provider_message_id = p_provider_message_id,
      error_code = p_error_code, error_message = left(p_error_message, 500)
  where email_log_id = p_email_log_id and attempt_number = v_attempt_count;
  return true;
end;
$$;

revoke all on function public.enqueue_application_email_deliveries(uuid, uuid, text, text, text) from public;
revoke all on function public.claim_due_application_email_deliveries(uuid, integer, uuid, text, text) from public;
revoke all on function public.complete_application_email_delivery(uuid, uuid, public.email_log_status, text, text, text, timestamptz, timestamptz) from public;
grant execute on function public.enqueue_application_email_deliveries(uuid, uuid, text, text, text) to service_role;
grant execute on function public.claim_due_application_email_deliveries(uuid, integer, uuid, text, text) to service_role;
grant execute on function public.complete_application_email_delivery(uuid, uuid, public.email_log_status, text, text, text, timestamptz, timestamptz) to service_role;
