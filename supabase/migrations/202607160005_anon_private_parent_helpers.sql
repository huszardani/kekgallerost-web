-- Anon cannot SELECT applications by design. SECURITY DEFINER predicates let
-- INSERT policies validate the private parent row without exposing it.

create or replace function public.can_insert_application_answer(
  target_application_id uuid,
  target_question_id uuid
)
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
    join public.job_questions on job_questions.id = target_question_id
      and job_questions.job_id = applications.job_id
    where applications.id = target_application_id
      and jobs.status = 'published'
      and applications.created_at >= now() - interval '30 minutes'
  );
$$;

revoke all on function public.can_insert_application_answer(uuid, uuid) from public;
grant execute on function public.can_insert_application_answer(uuid, uuid) to anon, authenticated;

drop policy if exists application_answers_public_published_insert on public.application_answers;
create policy application_answers_public_published_insert
on public.application_answers for insert to anon
with check (public.can_insert_application_answer(application_id, question_id));

create or replace function public.can_insert_uploaded_file_metadata(
  target_application_id uuid,
  target_bucket text,
  target_path text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    target_bucket = 'application-files'
    and target_path like ('applications/' || target_application_id::text || '/%')
    and exists (
      select 1
      from public.applications
      join public.jobs on jobs.id = applications.job_id
      where applications.id = target_application_id
        and jobs.status = 'published'
        and applications.created_at >= now() - interval '30 minutes'
    );
$$;

revoke all on function public.can_insert_uploaded_file_metadata(uuid, text, text) from public;
grant execute on function public.can_insert_uploaded_file_metadata(uuid, text, text) to anon, authenticated;

drop policy if exists uploaded_files_public_published_insert on public.uploaded_files;
create policy uploaded_files_public_published_insert
on public.uploaded_files for insert to anon
with check (
  public.can_insert_uploaded_file_metadata(application_id, storage_bucket, storage_path)
);

