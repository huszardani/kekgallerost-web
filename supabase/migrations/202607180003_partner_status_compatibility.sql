-- Keep the existing partner RPC compatible with the canonical CRM statuses.
create or replace function public.partner_update_application(
  p_application_id uuid, p_status text, p_partner_note text,
  p_callback_at timestamptz, p_last_contacted_at timestamptz
)
returns public.applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare updated_application public.applications;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('new', 'reviewed', 'contacted', 'interview', 'hired', 'rejected', 'withdrawn') then
    raise exception 'Invalid application status' using errcode = '22023';
  end if;
  update public.applications as application
  set status = coalesce(p_status, application.status), partner_note = p_partner_note,
      callback_at = p_callback_at, last_contacted_at = p_last_contacted_at
  from public.jobs as job
  where application.id = p_application_id and job.id = application.job_id
    and public.is_partner_for_company(job.company_id)
  returning application.* into updated_application;
  if updated_application.id is null then raise exception 'Application not found or access denied' using errcode = '42501'; end if;
  return updated_application;
end;
$$;

revoke all on function public.partner_update_application(uuid, text, text, timestamptz, timestamptz) from public;
grant execute on function public.partner_update_application(uuid, text, text, timestamptz, timestamptz) to authenticated;
