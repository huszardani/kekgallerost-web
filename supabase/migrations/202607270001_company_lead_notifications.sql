alter table public.company_leads
  add column if not exists notification_status text,
  add column if not exists notification_attempted_at timestamptz,
  add column if not exists notification_sent_at timestamptz,
  add column if not exists notification_provider_message_id text;

update public.company_leads
set notification_status = 'failed'
where notification_status is null;

alter table public.company_leads
  alter column notification_status set default 'pending',
  alter column notification_status set not null;

alter table public.company_leads
  drop constraint if exists company_leads_notification_status_check;

alter table public.company_leads
  add constraint company_leads_notification_status_check
  check (notification_status in ('pending', 'sent', 'failed'));

comment on column public.company_leads.notification_status is
  'A belső Resend értesítés állapota. A migráció előtti leadek failed állapotot kapnak, mert nem készült róluk értesítés.';
comment on column public.company_leads.notification_attempted_at is
  'Az első és egyetlen értesítési kísérlet időpontja.';
comment on column public.company_leads.notification_sent_at is
  'A sikeres Resend-küldés időpontja.';
comment on column public.company_leads.notification_provider_message_id is
  'A Resend által visszaadott üzenetazonosító.';

grant update (
  notification_status,
  notification_attempted_at,
  notification_sent_at,
  notification_provider_message_id
) on table public.company_leads to service_role;