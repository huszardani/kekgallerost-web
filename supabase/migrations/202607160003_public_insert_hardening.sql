-- Limit anonymous writes to the public form columns and a short upload window.
-- The production frontend submits through /api/applications; these grants also
-- make direct anon PostgREST use safe and least-privileged.

revoke insert on public.applications from anon;
grant insert (
  job_id,
  applicant_name,
  applicant_email,
  applicant_phone,
  candidate_name,
  candidate_email,
  candidate_phone,
  message,
  status,
  source,
  consent_accepted,
  consent_privacy
) on public.applications to anon;

revoke insert on public.application_answers from anon;
grant insert (
  application_id,
  question_id,
  answer_text,
  answer_json
) on public.application_answers to anon;

revoke insert on public.uploaded_files from anon;
grant insert (
  application_id,
  storage_bucket,
  storage_path,
  original_filename,
  mime_type,
  file_size,
  bucket,
  path,
  size_bytes
) on public.uploaded_files to anon;

drop policy if exists uploaded_files_public_published_insert on public.uploaded_files;
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
      and applications.created_at >= now() - interval '30 minutes'
  )
);

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
      and applications.created_at >= now() - interval '30 minutes'
  );
$$;

