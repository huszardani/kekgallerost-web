-- Kékgallérost.hu initial database schema
-- Project: kekgallerost
-- Region target: EU

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'partner');
create type public.job_status as enum ('draft', 'published', 'paused', 'closed');
create type public.application_status as enum (
  'new',
  'screening',
  'contacted',
  'shortlisted',
  'rejected',
  'hired'
);
create type public.question_type as enum (
  'short_text',
  'long_text',
  'single_choice',
  'multi_choice',
  'yes_no',
  'number',
  'file'
);
create type public.email_log_status as enum ('queued', 'sent', 'failed');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  billing_name text,
  tax_number text,
  contact_email text,
  contact_phone text,
  website_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  role public.app_role not null default 'partner',
  full_name text,
  email text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_requires_company check (
    role = 'admin' or company_id is not null
  )
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  slug text not null unique,
  location text,
  employment_type text,
  salary_text text,
  start_date_text text,
  summary text,
  description text,
  requirements text,
  benefits text,
  status public.job_status not null default 'draft',
  published_at timestamptz,
  application_deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_questions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  label text not null,
  help_text text,
  type public.question_type not null default 'short_text',
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_name text not null,
  candidate_email text not null,
  candidate_phone text,
  message text,
  status public.application_status not null default 'new',
  source text not null default 'website',
  consent_privacy boolean not null default false,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  question_id uuid not null references public.job_questions(id) on delete cascade,
  answer_text text,
  answer_json jsonb,
  created_at timestamptz not null default now(),
  unique (application_id, question_id)
);

create table public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  bucket text not null default 'application-files',
  path text not null,
  original_filename text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  provider text not null default 'resend',
  provider_message_id text,
  from_email text not null default 'info@kekgallerost.hu',
  to_email text not null,
  subject text not null,
  template_key text,
  status public.email_log_status not null default 'queued',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index companies_slug_idx on public.companies(slug);
create index profiles_company_id_idx on public.profiles(company_id);
create index profiles_role_idx on public.profiles(role);
create index jobs_company_id_idx on public.jobs(company_id);
create index jobs_status_idx on public.jobs(status);
create index jobs_slug_idx on public.jobs(slug);
create index job_questions_job_id_idx on public.job_questions(job_id);
create index applications_job_id_idx on public.applications(job_id);
create index applications_status_idx on public.applications(status);
create index application_answers_application_id_idx on public.application_answers(application_id);
create index uploaded_files_application_id_idx on public.uploaded_files(application_id);
create index email_logs_application_id_idx on public.email_logs(application_id);
create index email_logs_company_id_idx on public.email_logs(company_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_companies_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_jobs_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create trigger set_job_questions_updated_at
before update on public.job_questions
for each row execute function public.set_updated_at();

create trigger set_applications_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id
  from public.profiles
  where id = auth.uid()
    and is_active = true
  limit 1;
$$;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.job_questions enable row level security;
alter table public.applications enable row level security;
alter table public.application_answers enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.email_logs enable row level security;

create policy "Admins can manage companies"
on public.companies
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Partners can read their company"
on public.companies
for select
to authenticated
using (id = public.current_company_id());

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy "Admins can manage profiles"
on public.profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Public can read published jobs"
on public.jobs
for select
to anon, authenticated
using (status = 'published');

create policy "Admins can manage jobs"
on public.jobs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Partners can manage company jobs"
on public.jobs
for all
to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Public can read questions for published jobs"
on public.job_questions
for select
to anon, authenticated
using (
  exists (
    select 1 from public.jobs
    where jobs.id = job_questions.job_id
      and jobs.status = 'published'
  )
);

create policy "Admins can manage job questions"
on public.job_questions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Partners can manage questions for company jobs"
on public.job_questions
for all
to authenticated
using (
  exists (
    select 1 from public.jobs
    where jobs.id = job_questions.job_id
      and jobs.company_id = public.current_company_id()
  )
)
with check (
  exists (
    select 1 from public.jobs
    where jobs.id = job_questions.job_id
      and jobs.company_id = public.current_company_id()
  )
);

create policy "Public can create applications for published jobs"
on public.applications
for insert
to anon, authenticated
with check (
  consent_privacy = true
  and exists (
    select 1 from public.jobs
    where jobs.id = applications.job_id
      and jobs.status = 'published'
  )
);

create policy "Admins can manage applications"
on public.applications
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Partners can read company applications"
on public.applications
for select
to authenticated
using (
  exists (
    select 1 from public.jobs
    where jobs.id = applications.job_id
      and jobs.company_id = public.current_company_id()
  )
);

create policy "Partners can update company application status"
on public.applications
for update
to authenticated
using (
  exists (
    select 1 from public.jobs
    where jobs.id = applications.job_id
      and jobs.company_id = public.current_company_id()
  )
)
with check (
  exists (
    select 1 from public.jobs
    where jobs.id = applications.job_id
      and jobs.company_id = public.current_company_id()
  )
);

create policy "Public can create application answers"
on public.application_answers
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.applications
    join public.jobs on jobs.id = applications.job_id
    where applications.id = application_answers.application_id
      and jobs.status = 'published'
  )
);

create policy "Admins can read application answers"
on public.application_answers
for select
to authenticated
using (public.is_admin());

create policy "Partners can read company application answers"
on public.application_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.applications
    join public.jobs on jobs.id = applications.job_id
    where applications.id = application_answers.application_id
      and jobs.company_id = public.current_company_id()
  )
);

create policy "Admins can manage uploaded files"
on public.uploaded_files
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Partners can read company uploaded files"
on public.uploaded_files
for select
to authenticated
using (
  exists (
    select 1
    from public.applications
    join public.jobs on jobs.id = applications.job_id
    where applications.id = uploaded_files.application_id
      and jobs.company_id = public.current_company_id()
  )
);

create policy "Admins can manage email logs"
on public.email_logs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Partners can read company email logs"
on public.email_logs
for select
to authenticated
using (company_id = public.current_company_id());

comment on table public.companies is 'Partner companies that publish jobs on Kékgallérost.hu.';
comment on table public.profiles is 'Authenticated admin and partner user profiles linked to Supabase auth.users.';
comment on table public.jobs is 'Job postings shown at /allasok and /allas/[slug].';
comment on table public.job_questions is 'Custom application form questions per job.';
comment on table public.applications is 'Candidate applications submitted from public job pages.';
comment on table public.application_answers is 'Candidate answers to per-job questions.';
comment on table public.uploaded_files is 'Metadata for application-related files stored in Supabase Storage.';
comment on table public.email_logs is 'Audit log for Resend transactional emails.';
