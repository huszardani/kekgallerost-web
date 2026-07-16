-- PostgreSQL LEAST ignores NULL arguments. Preserve a genuinely unknown size
-- instead of turning it into the integer upper bound.

update public.uploaded_files
set file_size = null
where size_bytes is null and file_size = 2147483647;

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

  if new.file_size is null and new.size_bytes is not null then
    new.file_size := least(new.size_bytes, 2147483647)::integer;
  end if;
  if new.size_bytes is null and new.file_size is not null then
    new.size_bytes := new.file_size::bigint;
  end if;

  return new;
end;
$$;

