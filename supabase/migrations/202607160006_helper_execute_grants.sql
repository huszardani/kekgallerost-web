-- Keep SECURITY DEFINER predicates callable only by the roles whose policies use them.

revoke execute on function public.can_insert_application_answer(uuid, uuid) from authenticated;
revoke execute on function public.can_insert_uploaded_file_metadata(uuid, text, text) from authenticated;

revoke all on function public.can_upload_application_file(text) from public;
grant execute on function public.can_upload_application_file(text) to anon;

revoke all on function public.can_read_application_file(text) from public;
grant execute on function public.can_read_application_file(text) to authenticated;

revoke all on function public.application_id_from_storage_path(text) from public;

