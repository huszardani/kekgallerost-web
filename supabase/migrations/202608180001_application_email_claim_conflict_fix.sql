-- Resolve the PL/pgSQL output-column ambiguity in the recovery insert.
-- The prior migrations remain immutable; this migration only replaces the claim function.

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
  on conflict do nothing;

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

revoke all on function public.claim_due_application_email_deliveries(uuid, integer, uuid, text, text) from public;
grant execute on function public.claim_due_application_email_deliveries(uuid, integer, uuid, text, text) to service_role;
