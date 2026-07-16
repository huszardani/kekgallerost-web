-- Kékgallérost.hu recruitment data model hardening.
-- This migration intentionally extends the existing schema instead of replacing it.

-- -----------------------------------------------------------------------------
-- Canonical columns requested by the application, with legacy fields preserved.
-- -----------------------------------------------------------------------------

alter table public.companies
  add column if not exists description text,
  add column if not exists logo_url text,
  add column if not exists cover_image_url text,
  add column if not exists status text;

update public.companies
set status = case when is_active then 'active' else 'inactive' end
where status is null;

alter table public.companies
  alter column status set default 'active',
  alter column status set not null;

alter table public.companies drop constraint if exists companies_status_check;
alter table public.companies
  add constraint companies_status_check check (status in ('active', 'inactive'));

create or replace function public.sync_company_status()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.status := coalesce(new.status, case when new.is_active then 'active' else 'inactive' end);
    new.is_active := new.status = 'active';
  elsif new.status is distinct from old.status then
    new.is_active := new.status = 'active';
  elsif new.is_active is distinct from old.is_active then
    new.status := case when new.is_active then 'active' else 'inactive' end;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_company_status on public.companies;
create trigger sync_company_status
before insert or update on public.companies
for each row execute function public.sync_company_status();

alter table public.jobs
  add column if not exists short_description text,
  add column if not exists hero_image_url text;

update public.jobs
set short_description = summary
where short_description is null and summary is not null;

alter table public.jobs alter column status drop default;
alter table public.jobs alter column status type text using status::text;
update public.jobs set status = 'draft' where status = 'paused';
alter table public.jobs alter column status set default 'draft';
alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs
  add constraint jobs_status_check
  check (status in ('draft', 'published', 'closed', 'archived'));

alter table public.job_questions
  add column if not exists question_text text,
  add column if not exists question_type text;

update public.job_questions
set
  question_text = coalesce(question_text, label),
  question_type = coalesce(
    question_type,
    case type::text
      when 'short_text' then 'text'
      when 'long_text' then 'textarea'
      when 'single_choice' then 'select'
      when 'multi_choice' then 'multiselect'
      when 'yes_no' then 'boolean'
      when 'number' then 'text'
      when 'file' then 'file'
    end
  );

alter table public.job_questions
  alter column question_text set not null,
  alter column question_type set default 'text',
  alter column question_type set not null;

alter table public.job_questions drop constraint if exists job_questions_question_type_check;
alter table public.job_questions
  add constraint job_questions_question_type_check
  check (question_type in ('text', 'textarea', 'select', 'multiselect', 'boolean', 'file', 'phone', 'email'));

create or replace function public.sync_job_question_legacy_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.question_text := coalesce(nullif(new.question_text, ''), new.label);
  new.label := coalesce(nullif(new.label, ''), new.question_text);

  if new.question_type is null then
    new.question_type := case new.type::text
      when 'short_text' then 'text'
      when 'long_text' then 'textarea'
      when 'single_choice' then 'select'
      when 'multi_choice' then 'multiselect'
      when 'yes_no' then 'boolean'
      when 'file' then 'file'
      else 'text'
    end;
  end if;

  new.type := case new.question_type
    when 'textarea' then 'long_text'::public.question_type
    when 'select' then 'single_choice'::public.question_type
    when 'multiselect' then 'multi_choice'::public.question_type
    when 'boolean' then 'yes_no'::public.question_type
    when 'file' then 'file'::public.question_type
    else 'short_text'::public.question_type
  end;
  return new;
end;
$$;

drop trigger if exists sync_job_question_legacy_fields on public.job_questions;
create trigger sync_job_question_legacy_fields
before insert or update on public.job_questions
for each row execute function public.sync_job_question_legacy_fields();

alter table public.applications
  add column if not exists applicant_name text,
  add column if not exists applicant_email text,
  add column if not exists applicant_phone text,
  add column if not exists partner_note text,
  add column if not exists callback_at timestamptz,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists consent_accepted boolean;

update public.applications
set
  applicant_name = coalesce(applicant_name, candidate_name),
  applicant_email = coalesce(applicant_email, candidate_email),
  applicant_phone = coalesce(applicant_phone, candidate_phone),
  consent_accepted = coalesce(consent_accepted, consent_privacy);

alter table public.applications alter column status drop default;
alter table public.applications alter column status type text using status::text;
update public.applications set status = 'contacted' where status = 'screening';
update public.applications set status = 'suitable' where status = 'shortlisted';
alter table public.applications alter column status set default 'new';
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications
  add constraint applications_status_check
  check (status in (
    'new', 'contacted', 'no_answer', 'suitable', 'not_suitable',
    'second_call', 'callback_needed', 'hired', 'rejected'
  ));

alter table public.applications
  alter column applicant_name set not null,
  alter column applicant_email set not null,
  alter column consent_accepted set default false,
  alter column consent_accepted set not null;

create or replace function public.sync_application_legacy_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.applicant_name := coalesce(nullif(new.applicant_name, ''), new.candidate_name);
  new.candidate_name := coalesce(nullif(new.candidate_name, ''), new.applicant_name);
  new.applicant_email := coalesce(nullif(new.applicant_email, ''), new.candidate_email);
  new.candidate_email := coalesce(nullif(new.candidate_email, ''), new.applicant_email);
  new.applicant_phone := coalesce(new.applicant_phone, new.candidate_phone);
  new.candidate_phone := coalesce(new.candidate_phone, new.applicant_phone);
  new.consent_accepted := coalesce(new.consent_accepted, new.consent_privacy, false);
  new.consent_privacy := new.consent_accepted;
  return new;
end;
$$;

drop trigger if exists sync_application_legacy_fields on public.applications;
create trigger sync_application_legacy_fields
before insert or update on public.applications
for each row execute function public.sync_application_legacy_fields();

alter table public.uploaded_files
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists file_size integer;

update public.uploaded_files
set
  storage_bucket = coalesce(storage_bucket, bucket),
  storage_path = coalesce(storage_path, path),
  file_size = coalesce(file_size, least(size_bytes, 2147483647)::integer);

alter table public.uploaded_files
  alter column application_id set not null,
  alter column storage_bucket set default 'application-files',
  alter column storage_bucket set not null,
  alter column storage_path set not null;

alter table public.uploaded_files drop constraint if exists uploaded_files_file_size_check;
alter table public.uploaded_files
  add constraint uploaded_files_file_size_check check (file_size is null or file_size >= 0);

create or replace function public.sync_uploaded_file_legacy_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.storage_bucket := coalesce(new.storage_bucket, new.bucket, 'application-files');
  new.bucket := coalesce(new.bucket, new.storage_bucket);
  new.storage_path := coalesce(new.storage_path, new.path);
  new.path := coalesce(new.path, new.storage_path);
  new.file_size := coalesce(new.file_size, least(new.size_bytes, 2147483647)::integer);
  new.size_bytes := coalesce(new.size_bytes, new.file_size::bigint);
  return new;
end;
$$;

drop trigger if exists sync_uploaded_file_legacy_fields on public.uploaded_files;
create trigger sync_uploaded_file_legacy_fields
before insert or update on public.uploaded_files
for each row execute function public.sync_uploaded_file_legacy_fields();

create index if not exists applications_callback_at_idx on public.applications(callback_at);
create index if not exists job_questions_job_sort_idx on public.job_questions(job_id, sort_order);
create unique index if not exists uploaded_files_bucket_path_idx
  on public.uploaded_files(storage_bucket, storage_path);

-- -----------------------------------------------------------------------------
-- Auth helpers. SECURITY DEFINER avoids recursive profile RLS evaluation.
-- -----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select company_id
  from public.profiles
  where id = auth.uid()
    and role = 'partner'
    and is_active = true
  limit 1;
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_company_id();
$$;

create or replace function public.is_partner_for_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select target_company_id is not null
    and target_company_id = public.current_user_company_id();
$$;

-- Partner application updates are deliberately column-limited by this RPC.
create or replace function public.partner_update_application(
  p_application_id uuid,
  p_status text,
  p_partner_note text,
  p_callback_at timestamptz,
  p_last_contacted_at timestamptz
)
returns public.applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_application public.applications;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in (
    'new', 'contacted', 'no_answer', 'suitable', 'not_suitable',
    'second_call', 'callback_needed', 'hired', 'rejected'
  ) then
    raise exception 'Invalid application status' using errcode = '22023';
  end if;

  update public.applications as application
  set
    status = coalesce(p_status, application.status),
    partner_note = p_partner_note,
    callback_at = p_callback_at,
    last_contacted_at = p_last_contacted_at
  from public.jobs as job
  where application.id = p_application_id
    and job.id = application.job_id
    and public.is_partner_for_company(job.company_id)
  returning application.* into updated_application;

  if updated_application.id is null then
    raise exception 'Application not found or access denied' using errcode = '42501';
  end if;

  return updated_application;
end;
$$;

revoke all on function public.partner_update_application(uuid, text, text, timestamptz, timestamptz) from public;
grant execute on function public.partner_update_application(uuid, text, text, timestamptz, timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- Table RLS. Policies are intentionally separated by role and operation.
-- -----------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.job_questions enable row level security;
alter table public.applications enable row level security;
alter table public.application_answers enable row level security;
alter table public.uploaded_files enable row level security;

drop policy if exists "Admins can manage companies" on public.companies;
drop policy if exists "Partners can read their company" on public.companies;
drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Admins can manage profiles" on public.profiles;
drop policy if exists "Public can read published jobs" on public.jobs;
drop policy if exists "Admins can manage jobs" on public.jobs;
drop policy if exists "Partners can manage company jobs" on public.jobs;
drop policy if exists "Public can read questions for published jobs" on public.job_questions;
drop policy if exists "Admins can manage job questions" on public.job_questions;
drop policy if exists "Partners can manage questions for company jobs" on public.job_questions;
drop policy if exists "Public can create applications for published jobs" on public.applications;
drop policy if exists "Admins can manage applications" on public.applications;
drop policy if exists "Partners can read company applications" on public.applications;
drop policy if exists "Partners can update company application status" on public.applications;
drop policy if exists "Public can create application answers" on public.application_answers;
drop policy if exists "Admins can read application answers" on public.application_answers;
drop policy if exists "Partners can read company application answers" on public.application_answers;
drop policy if exists "Admins can manage uploaded files" on public.uploaded_files;
drop policy if exists "Partners can read company uploaded files" on public.uploaded_files;

create policy companies_admin_all
on public.companies for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy companies_partner_select
on public.companies for select to authenticated
using (public.is_partner_for_company(id));

create policy companies_public_published_select
on public.companies for select to anon
using (
  status = 'active'
  and exists (
    select 1 from public.jobs
    where jobs.company_id = companies.id and jobs.status = 'published'
  )
);

create policy profiles_admin_all
on public.profiles for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy profiles_self_or_company_select
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or (company_id is not null and public.is_partner_for_company(company_id))
);

create policy jobs_admin_all
on public.jobs for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy jobs_partner_select
on public.jobs for select to authenticated
using (public.is_partner_for_company(company_id));

create policy jobs_public_published_select
on public.jobs for select to anon
using (status = 'published');

create policy job_questions_admin_all
on public.job_questions for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy job_questions_partner_select
on public.job_questions for select to authenticated
using (
  exists (
    select 1 from public.jobs
    where jobs.id = job_questions.job_id
      and public.is_partner_for_company(jobs.company_id)
  )
);

create policy job_questions_public_published_select
on public.job_questions for select to anon
using (
  exists (
    select 1 from public.jobs
    where jobs.id = job_questions.job_id and jobs.status = 'published'
  )
);

create policy applications_admin_all
on public.applications for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy applications_partner_select
on public.applications for select to authenticated
using (
  exists (
    select 1 from public.jobs
    where jobs.id = applications.job_id
      and public.is_partner_for_company(jobs.company_id)
  )
);

create policy applications_public_published_insert
on public.applications for insert to anon
with check (
  status = 'new'
  and partner_note is null
  and callback_at is null
  and last_contacted_at is null
  and consent_accepted = true
  and exists (
    select 1 from public.jobs
    where jobs.id = applications.job_id and jobs.status = 'published'
  )
);

create policy application_answers_admin_all
on public.application_answers for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy application_answers_partner_select
on public.application_answers for select to authenticated
using (
  exists (
    select 1
    from public.applications
    join public.jobs on jobs.id = applications.job_id
    where applications.id = application_answers.application_id
      and public.is_partner_for_company(jobs.company_id)
  )
);

create policy application_answers_public_published_insert
on public.application_answers for insert to anon
with check (
  exists (
    select 1
    from public.applications
    join public.jobs on jobs.id = applications.job_id
    join public.job_questions on job_questions.id = application_answers.question_id
      and job_questions.job_id = applications.job_id
    where applications.id = application_answers.application_id
      and jobs.status = 'published'
  )
);

create policy uploaded_files_admin_all
on public.uploaded_files for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy uploaded_files_partner_select
on public.uploaded_files for select to authenticated
using (
  exists (
    select 1
    from public.applications
    join public.jobs on jobs.id = applications.job_id
    where applications.id = uploaded_files.application_id
      and public.is_partner_for_company(jobs.company_id)
  )
);

create policy uploaded_files_public_published_insert
on public.uploaded_files for insert to anon
with check (
  storage_bucket = 'application-files'
  and storage_path like ('applications/' || application_id::text || '/%')
  and exists (
    select 1
    from public.applications
    join public.jobs on jobs.id = applications.job_id
    where applications.id = uploaded_files.application_id
      and jobs.status = 'published'
  )
);

-- Explicit API grants; RLS remains the authorization boundary.
grant select on public.companies, public.jobs, public.job_questions to anon;
grant insert on public.applications, public.application_answers, public.uploaded_files to anon;
revoke select on public.profiles, public.applications, public.application_answers, public.uploaded_files from anon;
grant select, insert, update, delete on public.companies, public.profiles, public.jobs,
  public.job_questions, public.applications, public.application_answers, public.uploaded_files to authenticated;

-- -----------------------------------------------------------------------------
-- Private Storage bucket and storage.objects RLS.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('application-files', 'application-files', false, 10485760)
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit;

create or replace function public.application_id_from_storage_path(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  id_text text;
begin
  if object_name !~ '^applications/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/[^/]+$' then
    return null;
  end if;
  id_text := split_part(object_name, '/', 2);
  return id_text::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function public.can_upload_application_file(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.applications
    join public.jobs on jobs.id = applications.job_id
    where applications.id = public.application_id_from_storage_path(object_name)
      and jobs.status = 'published'
  );
$$;

create or replace function public.can_read_application_file(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_admin() or exists (
    select 1
    from public.applications
    join public.jobs on jobs.id = applications.job_id
    where applications.id = public.application_id_from_storage_path(object_name)
      and public.is_partner_for_company(jobs.company_id)
  );
$$;

drop policy if exists application_files_public_insert on storage.objects;
drop policy if exists application_files_authenticated_select on storage.objects;
drop policy if exists application_files_admin_all on storage.objects;

create policy application_files_public_insert
on storage.objects for insert to anon
with check (
  bucket_id = 'application-files'
  and public.can_upload_application_file(name)
);

create policy application_files_authenticated_select
on storage.objects for select to authenticated
using (
  bucket_id = 'application-files'
  and public.can_read_application_file(name)
);

create policy application_files_admin_all
on storage.objects for all to authenticated
using (bucket_id = 'application-files' and public.is_admin())
with check (bucket_id = 'application-files' and public.is_admin());

comment on function public.partner_update_application(uuid, text, text, timestamptz, timestamptz)
is 'Partner-safe application update RPC: only status, note, callback and last-contacted fields are writable.';

