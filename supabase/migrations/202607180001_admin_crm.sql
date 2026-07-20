-- Kékgallérost admin CRM extension.
-- Non-destructive: existing entities and data are retained and normalized.

-- Jobs -----------------------------------------------------------------------

alter table public.jobs drop constraint if exists jobs_status_check;
update public.jobs set status = 'closed' where status = 'archived';
alter table public.jobs
  add constraint jobs_status_check
  check (status in ('draft', 'published', 'paused', 'closed'));

alter table public.jobs
  add column if not exists category text,
  add column if not exists work_mode text,
  add column if not exists work_schedule text,
  add column if not exists tasks text,
  add column if not exists advantages text,
  add column if not exists important_information text,
  add column if not exists start_date date,
  add column if not exists paused_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists resume_enabled boolean not null default true;

-- Applications ---------------------------------------------------------------

alter table public.applications drop constraint if exists applications_status_check;
update public.applications set status = case status
  when 'no_answer' then 'contacted'
  when 'suitable' then 'reviewed'
  when 'not_suitable' then 'rejected'
  when 'second_call' then 'contacted'
  when 'callback_needed' then 'contacted'
  else status
end;
alter table public.applications
  add constraint applications_status_check
  check (status in ('new', 'reviewed', 'contacted', 'interview', 'hired', 'rejected', 'withdrawn'));

alter table public.applications
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists viewed_at timestamptz;

update public.applications
set privacy_accepted_at = coalesce(privacy_accepted_at, submitted_at, created_at)
where consent_accepted = true or consent_privacy = true;

-- Keep historic answers intelligible when a question is renamed or removed.
alter table public.application_answers
  add column if not exists question_label_snapshot text;

update public.application_answers as answer
set question_label_snapshot = coalesce(answer.question_label_snapshot, question.question_text, question.label, 'Korábbi kérdés')
from public.job_questions as question
where question.id = answer.question_id
  and answer.question_label_snapshot is null;

update public.application_answers
set question_label_snapshot = 'Korábbi kérdés'
where question_label_snapshot is null;

alter table public.application_answers
  alter column question_label_snapshot set not null,
  alter column question_id drop not null;

alter table public.application_answers
  drop constraint if exists application_answers_question_id_fkey;
alter table public.application_answers
  add constraint application_answers_question_id_fkey
  foreign key (question_id) references public.job_questions(id) on delete set null;

create or replace function public.snapshot_application_answer_question()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.question_label_snapshot is null or btrim(new.question_label_snapshot) = '' then
    select coalesce(question_text, label, 'Korábbi kérdés')
      into new.question_label_snapshot
    from public.job_questions
    where id = new.question_id;
  end if;
  new.question_label_snapshot := coalesce(nullif(btrim(new.question_label_snapshot), ''), 'Korábbi kérdés');
  return new;
end;
$$;

drop trigger if exists snapshot_application_answer_question on public.application_answers;
create trigger snapshot_application_answer_question
before insert or update of question_id on public.application_answers
for each row execute function public.snapshot_application_answer_question();

-- Notes, activity and editable e-mail template -------------------------------

create table if not exists public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 5000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('job', 'application', 'note', 'email', 'company')),
  entity_id uuid not null,
  action text not null,
  previous_value text,
  new_value text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.email_templates (
  id text primary key,
  subject text not null,
  intro_text text not null,
  next_step_text text not null,
  contact_details text not null,
  signature text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.email_templates (id, subject, intro_text, next_step_text, contact_details, signature)
values (
  'application_confirmation',
  'Jelentkezésed megérkezett – {{job_title}}',
  'Köszönjük, hogy jelentkeztél. Az alábbiakban összefoglaljuk a beküldött adataidat.',
  'Munkatársunk hamarosan átnézi a jelentkezésedet, és a megadott elérhetőségeid egyikén jelentkezik.',
  'Kérdés esetén írj az info@kekgallerost.hu címre.',
  'Üdvözlettel,\nA Kékgalléros csapata'
)
on conflict (id) do nothing;

alter table public.email_logs
  add column if not exists delivery_key text;
create unique index if not exists email_logs_delivery_key_idx
  on public.email_logs(delivery_key)
  where delivery_key is not null;

create index if not exists jobs_updated_at_idx on public.jobs(updated_at desc);
create index if not exists applications_created_at_idx on public.applications(created_at desc);
create index if not exists application_notes_application_idx on public.application_notes(application_id, created_at desc);
create index if not exists activity_logs_entity_idx on public.activity_logs(entity_type, entity_id, created_at desc);
create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);

create trigger set_application_notes_updated_at
before update on public.application_notes
for each row execute function public.set_updated_at();

create trigger set_email_templates_updated_at
before update on public.email_templates
for each row execute function public.set_updated_at();

create or replace function public.log_recruitment_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'jobs' and new.status is distinct from old.status then
    insert into public.activity_logs(entity_type, entity_id, action, previous_value, new_value, actor_id)
    values ('job', new.id, 'status_changed', old.status, new.status, auth.uid());
  elsif tg_table_name = 'applications' and new.status is distinct from old.status then
    insert into public.activity_logs(entity_type, entity_id, action, previous_value, new_value, actor_id)
    values ('application', new.id, 'status_changed', old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists log_job_status_change on public.jobs;
create trigger log_job_status_change
after update of status on public.jobs
for each row execute function public.log_recruitment_status_change();

drop trigger if exists log_application_status_change on public.applications;
create trigger log_application_status_change
after update of status on public.applications
for each row execute function public.log_recruitment_status_change();

-- Admin RLS. Existing partner access remains unchanged on the original tables.
alter table public.application_notes enable row level security;
alter table public.activity_logs enable row level security;
alter table public.email_templates enable row level security;

create policy application_notes_admin_all
on public.application_notes for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy activity_logs_admin_all
on public.activity_logs for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy email_templates_admin_all
on public.email_templates for all to authenticated
using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.application_notes, public.activity_logs to authenticated;
grant select, update on public.email_templates to authenticated;

comment on table public.application_notes is 'Internal CRM notes; never exposed to public or e-mail rendering.';
comment on table public.activity_logs is 'Immutable recruitment activity and status audit trail.';
comment on table public.email_templates is 'Admin-editable copy around mandatory application confirmation data.';
