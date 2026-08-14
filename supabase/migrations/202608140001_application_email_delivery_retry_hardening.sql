-- Follow-up hardening for application-email delivery requests and bounded retries.
-- Keep the original migration immutable and preserve historical fourth-attempt audit rows.

alter table public.applications
  add column if not exists email_delivery_requested_at timestamptz;

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
  on conflict (delivery_key) where delivery_key is not null do nothing;
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
  worker_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The application row records the durable delivery request. Recreate missing
  -- queue rows here if the initial enqueue operation failed after persistence.
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
    and (p_application_id is null or applications.id = p_application_id)
  on conflict (delivery_key) where delivery_key is not null do nothing;

  return query
  with candidates as (
    select logs.id
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
    for update skip locked
    limit greatest(1, least(p_limit, 100))
  ), claimed as (
    update public.email_logs as logs
    set attempt_count = logs.attempt_count + 1,
        last_attempt_at = now(),
        next_attempt_at = null,
        locked_at = now(),
        locked_by = p_worker_id,
        error_code = null,
        error_message = null
    from candidates
    where logs.id = candidates.id
    returning logs.id, logs.application_id, logs.company_id, logs.recipient_role,
      logs.delivery_key, logs.attempt_count, logs.locked_by
  ), attempts as (
    insert into public.email_delivery_attempts (email_log_id, attempt_number, status)
    select claimed.id, claimed.attempt_count, 'started'
    from claimed
    returning email_log_id
  )
  select claimed.id, claimed.application_id, claimed.company_id, claimed.recipient_role,
    claimed.delivery_key, claimed.attempt_count, claimed.locked_by
  from claimed
  join attempts on attempts.email_log_id = claimed.id;
end;
$$;

revoke all on function public.enqueue_application_email_deliveries(uuid, uuid, text, text, text) from public;
revoke all on function public.claim_due_application_email_deliveries(uuid, integer, uuid, text, text) from public;
grant execute on function public.enqueue_application_email_deliveries(uuid, uuid, text, text, text) to service_role;
grant execute on function public.claim_due_application_email_deliveries(uuid, integer, uuid, text, text) to service_role;
