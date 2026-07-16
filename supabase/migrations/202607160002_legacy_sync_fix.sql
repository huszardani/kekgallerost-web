-- Preserve compatibility with writes that still use the initial migration's
-- legacy fields while canonical columns are introduced.

alter table public.companies alter column status drop default;
alter table public.job_questions alter column question_type drop default;

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

  if tg_op = 'INSERT' then
    new.consent_accepted := coalesce(new.consent_accepted, false)
      or coalesce(new.consent_privacy, false);
  else
    new.consent_accepted := coalesce(new.consent_accepted, new.consent_privacy, false);
  end if;

  new.consent_privacy := new.consent_accepted;
  return new;
end;
$$;

