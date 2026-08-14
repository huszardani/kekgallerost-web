-- Durable application-email queue with bounded retries.
-- This migration is backward compatible with the existing queued/sent/failed states.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

alter table public.email_logs
  alter column to_email drop not null,
  add column if not exists recipient_role text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid,
  add column if not exists error_code text;

alter table public.applications
  add column if not exists email_delivery_requested_at timestamptz;

alter table public.email_logs
  drop constraint if exists email_logs_recipient_role_check,
  add constraint email_logs_recipient_role_check
    check (recipient_role is null or recipient_role in ('applicant', 'admin', 'partner')),
  drop constraint if exists email_logs_attempt_count_check,
  add constraint email_logs_attempt_count_check check (attempt_count between 0 and 3);

create index if not exists email_logs_due_delivery_idx
  on public.email_logs(next_attempt_at, created_at)
  where status = 'queued' and next_attempt_at is not null;

create table if not exists public.email_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  email_log_id uuid not null references public.email_logs(id) on delete cascade,
  attempt_number integer not null check (attempt_number between 1 and 3),
  status text not null check (status in ('started', 'sent', 'retry_scheduled', 'failed')),
  attempted_at timestamptz not null default now(),
  completed_at timestamptz,
  provider_message_id text,
  error_code text,
  error_message text,
  unique (email_log_id, attempt_number)
);

alter table public.email_delivery_attempts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'email_delivery_attempts'
      and policyname = 'Admins can read email delivery attempts'
  ) then
    create policy "Admins can read email delivery attempts"
    on public.email_delivery_attempts
    for select
    to authenticated
    using (public.is_admin());
  end if;
end;
$$;

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

create or replace function public.complete_application_email_delivery(
  p_email_log_id uuid,
  p_worker_id uuid,
  p_status public.email_log_status,
  p_provider_message_id text default null,
  p_error_code text default null,
  p_error_message text default null,
  p_next_attempt_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_count integer;
begin
  if p_status not in ('queued', 'sent', 'failed') then
    raise exception 'Unsupported email delivery status';
  end if;

  update public.email_logs
  set status = p_status,
      provider_message_id = case when p_status = 'sent' then p_provider_message_id else provider_message_id end,
      sent_at = case when p_status = 'sent' then now() else sent_at end,
      next_attempt_at = case when p_status = 'queued' then p_next_attempt_at else null end,
      error_code = p_error_code,
      error_message = left(p_error_message, 500),
      locked_at = null,
      locked_by = null
  where id = p_email_log_id
    and locked_by = p_worker_id
  returning attempt_count into v_attempt_count;

  if v_attempt_count is null then
    return false;
  end if;

  update public.email_delivery_attempts
  set status = case p_status
      when 'sent' then 'sent'
      when 'queued' then 'retry_scheduled'
      else 'failed'
    end,
    completed_at = now(),
    provider_message_id = p_provider_message_id,
    error_code = p_error_code,
    error_message = left(p_error_message, 500)
  where email_log_id = p_email_log_id
    and attempt_number = v_attempt_count;

  return true;
end;
$$;

revoke all on function public.enqueue_application_email_deliveries(uuid, uuid, text, text, text) from public;
revoke all on function public.claim_due_application_email_deliveries(uuid, integer, uuid, text, text) from public;
revoke all on function public.complete_application_email_delivery(uuid, uuid, public.email_log_status, text, text, text, timestamptz) from public;
grant execute on function public.enqueue_application_email_deliveries(uuid, uuid, text, text, text) to service_role;
grant execute on function public.claim_due_application_email_deliveries(uuid, integer, uuid, text, text) to service_role;
grant execute on function public.complete_application_email_delivery(uuid, uuid, public.email_log_status, text, text, text, timestamptz) to service_role;

comment on table public.email_delivery_attempts is
  'Durable, privacy-minimized audit rows for each application-email delivery attempt.';
comment on column public.email_logs.next_attempt_at is
  'Queued delivery becomes claimable at this timestamp. Null for sent, final failed, or currently claimed rows.';

-- Deliberately not invoked by this migration. Before production activation, create
-- application_email_worker_url and application_email_worker_secret in Supabase Vault,
-- deploy the protected worker endpoint, then call this function with separate approval.
create or replace function public.configure_application_email_retry_cron()
returns bigint
language plpgsql
security definer
set search_path = public, vault, cron, net
as $$
declare
  v_job_id bigint;
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'application_email_worker_url')
    or not exists (select 1 from vault.decrypted_secrets where name = 'application_email_worker_secret') then
    raise exception 'Required application email worker Vault secrets are missing';
  end if;

  if exists (select 1 from cron.job where jobname = 'application-email-retry-worker') then
    perform cron.unschedule('application-email-retry-worker');
  end if;

  select cron.schedule(
    'application-email-retry-worker',
    '* * * * *',
    $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'application_email_worker_url'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'application_email_worker_secret')
        ),
        body := '{}'::jsonb
      );
    $cron$
  ) into v_job_id;
  return v_job_id;
end;
$$;

revoke all on function public.configure_application_email_retry_cron() from public;
grant execute on function public.configure_application_email_retry_cron() to service_role;
