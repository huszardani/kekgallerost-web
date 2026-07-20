-- Dynamic job pages: centralized content blocks, media, screening and publishing.

alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs
  add constraint jobs_status_check
  check (status in ('draft', 'ready', 'published', 'paused', 'closed', 'archived'));

alter table public.jobs
  add column if not exists employer_label text,
  add column if not exists city text,
  add column if not exists workplace_address text,
  add column if not exists employment_fraction text,
  add column if not exists salary_display_mode text not null default 'text',
  add column if not exists salary_min integer,
  add column if not exists salary_max integer,
  add column if not exists salary_currency text not null default 'HUF',
  add column if not exists salary_period text not null default 'month',
  add column if not exists intro_text text,
  add column if not exists compensation_details text,
  add column if not exists schedule_details text,
  add column if not exists workplace_details text,
  add column if not exists selection_process text,
  add column if not exists closing_cta text,
  add column if not exists hero_image_alt text,
  add column if not exists hero_focus_x smallint not null default 50,
  add column if not exists hero_focus_y smallint not null default 50,
  add column if not exists social_image_url text,
  add column if not exists scheduled_publish_at timestamptz,
  add column if not exists publish_timezone text not null default 'Europe/Budapest',
  add column if not exists ready_at timestamptz,
  add column if not exists archived_at timestamptz;

alter table public.jobs drop constraint if exists jobs_salary_display_mode_check;
alter table public.jobs
  add constraint jobs_salary_display_mode_check
  check (salary_display_mode in ('hidden', 'text', 'range'));
alter table public.jobs drop constraint if exists jobs_salary_range_check;
alter table public.jobs
  add constraint jobs_salary_range_check
  check (salary_min is null or salary_max is null or salary_min <= salary_max);
alter table public.jobs drop constraint if exists jobs_hero_focus_check;
alter table public.jobs
  add constraint jobs_hero_focus_check
  check (hero_focus_x between 0 and 100 and hero_focus_y between 0 and 100);

create table if not exists public.job_content_blocks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  block_type text not null,
  eyebrow text,
  title text,
  body text,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_content_blocks_type_check check (block_type in (
    'intro', 'role', 'fit', 'tasks', 'requirements', 'advantages', 'benefits',
    'compensation', 'schedule', 'location', 'process', 'company', 'faq',
    'important', 'closing'
  )),
  unique (job_id, block_type)
);

create table if not exists public.job_content_items (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.job_content_blocks(id) on delete cascade,
  item_type text not null default 'bullet',
  title text,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_content_items_type_check check (item_type in ('bullet', 'highlight', 'fact', 'faq'))
);

create table if not exists public.job_media (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  kind text not null,
  storage_bucket text,
  storage_path text,
  url text not null,
  alt_text text not null default '',
  focus_x smallint not null default 50,
  focus_y smallint not null default 50,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_media_kind_check check (kind in ('hero', 'gallery', 'social')),
  constraint job_media_focus_check check (focus_x between 0 and 100 and focus_y between 0 and 100)
);

alter table public.job_questions
  add column if not exists internal_note text,
  add column if not exists is_disqualifying boolean not null default false;
alter table public.job_questions drop constraint if exists job_questions_question_type_check;
alter table public.job_questions
  add constraint job_questions_question_type_check
  check (question_type in (
    'text', 'textarea', 'number', 'radio', 'select', 'multiselect', 'checkbox',
    'date', 'boolean', 'file', 'resume', 'phone', 'email'
  ));

create table if not exists public.job_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.job_questions(id) on delete cascade,
  value text not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (question_id, value)
);

create table if not exists public.job_disqualification_rules (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null unique references public.job_questions(id) on delete cascade,
  operator text not null default 'equals',
  values jsonb not null default '[]'::jsonb,
  target_status text not null default 'not_qualified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_disqualification_rules_operator_check check (operator in ('equals', 'contains_any')),
  constraint job_disqualification_rules_status_check check (target_status = 'not_qualified'),
  constraint job_disqualification_rules_values_check check (jsonb_typeof(values) = 'array')
);

alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications
  add constraint applications_status_check
  check (status in ('new', 'reviewed', 'contacted', 'interview', 'hired', 'rejected', 'withdrawn', 'not_qualified'));

create index if not exists job_content_blocks_job_sort_idx on public.job_content_blocks(job_id, sort_order);
create index if not exists job_content_items_block_sort_idx on public.job_content_items(block_id, sort_order);
create index if not exists job_media_job_kind_sort_idx on public.job_media(job_id, kind, sort_order);
create index if not exists job_question_options_question_sort_idx on public.job_question_options(question_id, sort_order);
create index if not exists jobs_scheduled_publish_idx on public.jobs(scheduled_publish_at) where status = 'ready';

drop trigger if exists set_job_content_blocks_updated_at on public.job_content_blocks;
create trigger set_job_content_blocks_updated_at before update on public.job_content_blocks
for each row execute function public.set_updated_at();
drop trigger if exists set_job_content_items_updated_at on public.job_content_items;
create trigger set_job_content_items_updated_at before update on public.job_content_items
for each row execute function public.set_updated_at();
drop trigger if exists set_job_media_updated_at on public.job_media;
create trigger set_job_media_updated_at before update on public.job_media
for each row execute function public.set_updated_at();
drop trigger if exists set_job_disqualification_rules_updated_at on public.job_disqualification_rules;
create trigger set_job_disqualification_rules_updated_at before update on public.job_disqualification_rules
for each row execute function public.set_updated_at();

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
      when 'short_text' then 'text' when 'long_text' then 'textarea'
      when 'single_choice' then 'select' when 'multi_choice' then 'multiselect'
      when 'yes_no' then 'boolean' when 'file' then 'file' else 'text' end;
  end if;
  new.type := case new.question_type
    when 'textarea' then 'long_text'::public.question_type
    when 'select' then 'single_choice'::public.question_type
    when 'radio' then 'single_choice'::public.question_type
    when 'multiselect' then 'multi_choice'::public.question_type
    when 'boolean' then 'yes_no'::public.question_type
    when 'checkbox' then 'yes_no'::public.question_type
    when 'file' then 'file'::public.question_type
    when 'resume' then 'file'::public.question_type
    when 'number' then 'number'::public.question_type
    else 'short_text'::public.question_type end;
  return new;
end;
$$;

create or replace function public.activate_scheduled_jobs()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare activated_count integer;
begin
  update public.jobs
  set status = 'published',
      published_at = coalesce(published_at, now()),
      scheduled_publish_at = null,
      paused_at = null,
      closed_at = null
  where status = 'ready'
    and scheduled_publish_at is not null
    and scheduled_publish_at <= now();
  get diagnostics activated_count = row_count;
  return activated_count;
end;
$$;
revoke all on function public.activate_scheduled_jobs() from public;
grant execute on function public.activate_scheduled_jobs() to service_role;

alter table public.job_content_blocks enable row level security;
alter table public.job_content_items enable row level security;
alter table public.job_media enable row level security;
alter table public.job_question_options enable row level security;
alter table public.job_disqualification_rules enable row level security;

create policy job_content_blocks_admin_all on public.job_content_blocks for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy job_content_blocks_public_select on public.job_content_blocks for select to anon
using (exists (select 1 from public.jobs where jobs.id = job_content_blocks.job_id and jobs.status = 'published'));
create policy job_content_items_admin_all on public.job_content_items for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy job_content_items_public_select on public.job_content_items for select to anon
using (exists (
  select 1 from public.job_content_blocks b join public.jobs j on j.id = b.job_id
  where b.id = job_content_items.block_id and j.status = 'published'
));
create policy job_media_admin_all on public.job_media for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy job_media_public_select on public.job_media for select to anon
using (exists (select 1 from public.jobs where jobs.id = job_media.job_id and jobs.status = 'published'));
create policy job_question_options_admin_all on public.job_question_options for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy job_question_options_public_select on public.job_question_options for select to anon
using (exists (
  select 1 from public.job_questions q join public.jobs j on j.id = q.job_id
  where q.id = job_question_options.question_id and j.status = 'published'
));
create policy job_disqualification_rules_admin_all on public.job_disqualification_rules for all to authenticated
using (public.is_admin()) with check (public.is_admin());

grant select on public.job_content_blocks, public.job_content_items, public.job_media, public.job_question_options to anon;
grant select, insert, update, delete on public.job_content_blocks, public.job_content_items, public.job_media,
  public.job_question_options, public.job_disqualification_rules to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-media', 'job-media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy job_media_storage_admin_insert on storage.objects for insert to authenticated
with check (bucket_id = 'job-media' and public.is_admin());
create policy job_media_storage_admin_update on storage.objects for update to authenticated
using (bucket_id = 'job-media' and public.is_admin()) with check (bucket_id = 'job-media' and public.is_admin());
create policy job_media_storage_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'job-media' and public.is_admin());
create policy job_media_storage_public_select on storage.objects for select to anon, authenticated
using (bucket_id = 'job-media');

-- Seed the current Fuvarszervező page into the centralized model.
update public.jobs
set employer_label = 'Megbízónk', city = 'Nagytarcsa', workplace_address = '2142 Nagytarcsa, Naplás út 1.',
    employment_fraction = 'Teljes munkaidő', intro_text = 'Fuvarszervezés és logisztika',
    compensation_details = 'Fix bér + célprémium / bónusz, egyeztetés szerinti részletekkel.',
    schedule_details = 'Hétfőtől péntekig, irodai jelenléttel.',
    workplace_details = '2142 Nagytarcsa, Naplás út 1. A napi bejárás szükséges; saját autó előny.',
    selection_process = 'A jelentkezés áttekintése után telefonos egyeztetés, majd személyes szakmai beszélgetés következik.',
    closing_cta = 'Ha szereted a rendszert, a tempót és a tiszta felelősségi köröket, jelentkezz most!',
    hero_image_alt = 'Fuvarszervező modern logisztikai környezetben', social_image_url = '/assets/job-fuvarszervezo-nagytarcsa-custom.png'
where slug = 'fuvarszervezo-nagytarcsa';

insert into public.job_content_blocks (job_id, block_type, eyebrow, title, body, is_visible, sort_order)
select jobs.id, seeded.block_type, seeded.eyebrow, seeded.title, seeded.body, true, seeded.sort_order
from public.jobs cross join (values
  ('intro', 'Fuvarszervezés és logisztika', 'Irodai fuvarszervezői szerep azoknak, akik szeretik a rendszert, a tempót és a tiszta felelősségi köröket.', null, 10),
  ('role', 'A munkakör', 'Mit csinál egy fuvarszervező?', 'A fuvarszervező a napi szállítási operáció kapcsolati pontja: összehangolja a fuvarokat, a járműkapacitást, a sofőröket, az ügyfeleket és a határidőket.', 20),
  ('fit', 'Neked való, ha', 'Magadra ismersz?', null, 30),
  ('tasks', 'Napi feladatok', 'Mit fogsz csinálni?', null, 40),
  ('requirements', 'Elvárások', 'Amit kérünk', null, 50),
  ('advantages', 'Előnyt jelent', 'Ami pluszt ad', null, 60),
  ('benefits', 'Amit kínálunk', 'Stabil háttér és átlátható célok', null, 70),
  ('compensation', 'Bér és juttatások', 'Átlag ~650 000 Ft/hó', 'Fix bér + célprémium / bónusz, egyeztetés szerinti részletekkel.', 80),
  ('schedule', 'Munkavégzés', 'Nagytarcsa, hétfőtől péntekig', 'Teljes munkaidő, irodai jelenléttel.', 90),
  ('process', 'Kiválasztási folyamat', 'Így haladunk tovább', 'A jelentkezés áttekintése után telefonos egyeztetés, majd személyes szakmai beszélgetés következik.', 100),
  ('company', 'A cégről', 'Ellenőrzött fuvarozási partner', null, 110),
  ('faq', 'Gyakori kérdések', 'Amit érdemes tudnod jelentkezés előtt', null, 120),
  ('closing', 'Jelentkezz', 'Készen állsz a következő lépésre?', 'Ha szereted a rendszert, a tempót és a tiszta felelősségi köröket, jelentkezz most!', 130)
) as seeded(block_type, eyebrow, title, body, sort_order)
where jobs.slug = 'fuvarszervezo-nagytarcsa'
on conflict (job_id, block_type) do update set eyebrow = excluded.eyebrow, title = excluded.title,
  body = excluded.body, sort_order = excluded.sort_order, is_visible = true;

insert into public.job_content_items (block_id, item_type, title, body, sort_order)
select block.id, seeded.item_type, seeded.title, seeded.body, seeded.sort_order
from (values
  ('role','bullet',null,'Belföldi és nemzetközi fuvarok szervezése és követése.',10),
  ('role','bullet',null,'Ügyfél-, sofőr- és alvállalkozói kommunikáció.',20),
  ('role','bullet',null,'Útvonalak, időablakok és rakodási idők figyelése.',30),
  ('fit','bullet',null,'Legalább 2 éve dolgozol fuvarszervezőként vagy hasonló logisztikai szerepben.',10),
  ('fit','bullet',null,'Magabiztosan egyeztetsz ügyfelekkel, sofőrökkel és alvállalkozókkal.',20),
  ('fit','bullet',null,'Gyorsan priorizálsz, és nem hagysz nyitott végeket.',30),
  ('tasks','bullet',null,'Belföldi és nemzetközi fuvarok szervezése, ajánlatkérés és kapacitáslekötés.',10),
  ('tasks','bullet',null,'Fuvarmegbízások, útvonalak, időablakok és rakodási idők egyeztetése.',20),
  ('tasks','bullet',null,'CMR és kísérő okmányok, engedélyek és státuszok kezelése.',30),
  ('tasks','bullet',null,'Kihasználtság, költség és idő optimalizálása.',40),
  ('requirements','bullet',null,'Minimum 2 év fuvarszervezési tapasztalat.',10),
  ('requirements','bullet',null,'Belföldi fuvarokban biztos rutin; nemzetközi tapasztalat előny.',20),
  ('requirements','bullet',null,'Erős szervezői készség és magabiztos kommunikáció.',30),
  ('requirements','bullet',null,'Irodai jelenlét vállalása Nagytarcsán.',40),
  ('advantages','bullet',null,'Nemzetközi fuvarozási tapasztalat.',10),
  ('advantages','bullet',null,'Kapacitás-optimalizálásban és költségkontrollban szerzett rutin.',20),
  ('advantages','bullet',null,'Rendszerszemlélet és pontos utánkövetés.',30),
  ('benefits','bullet',null,'Stabil fix bér + célprémium / bónusz.',10),
  ('benefits','bullet',null,'Átlátható célokhoz kötött bónuszrendszer.',20),
  ('benefits','bullet',null,'Első kifizetés az első naptári hónapban.',30),
  ('benefits','bullet',null,'Támogató, következetes szakmai vezetés.',40),
  ('schedule','fact','Helyszín','2142 Nagytarcsa, Naplás út 1.',10),
  ('schedule','fact','Munkaidő','Teljes munkaidő, irodai jelenléttel',20),
  ('schedule','fact','Kezdés','Megegyezés szerint',30),
  ('schedule','fact','Bejárás','Saját autó előny',40),
  ('faq','faq','Kell nemzetközi tapasztalat?','Nem kötelező, de előny. A rendszerszemlélet és a stabil fuvarszervezői alap fontosabb.',10),
  ('faq','faq','Van home office?','A pozíció irodai, mert a napi operációhoz gyors együttműködés és helyzetkezelés kell.',20),
  ('faq','faq','Van betanítás?','Igen, a saját folyamatokra kapsz betanítást.',30)
) as seeded(block_type, item_type, title, body, sort_order)
join public.jobs job on job.slug = 'fuvarszervezo-nagytarcsa'
join public.job_content_blocks block on block.job_id = job.id and block.block_type = seeded.block_type
where not exists (
  select 1 from public.job_content_items existing
  where existing.block_id = block.id and existing.sort_order = seeded.sort_order
);

insert into public.job_media (job_id, kind, url, alt_text, focus_x, focus_y, sort_order)
select jobs.id, seeded.kind, seeded.url, seeded.alt_text, 50, 50, seeded.sort_order
from public.jobs cross join (values
  ('hero','/assets/job-fuvarszervezo-nagytarcsa-custom.png','Fuvarszervező modern logisztikai környezetben',0),
  ('gallery','/assets/job-fuvarszervezo-nagytarcsa.png','Fuvarszervező munka logisztikai irodában',10),
  ('gallery','/assets/job-fuvarszervezo-nagytarcsa-tasks.png','Fuvarfeladatok koordinálása',20),
  ('social','/assets/job-fuvarszervezo-nagytarcsa-custom.png','Fuvarszervező állás közösségi előnézete',0)
) as seeded(kind, url, alt_text, sort_order)
where jobs.slug = 'fuvarszervezo-nagytarcsa'
and not exists (select 1 from public.job_media existing where existing.job_id = jobs.id and existing.kind = seeded.kind and existing.url = seeded.url);

insert into public.job_question_options (question_id, value, label, sort_order)
select question.id, option_value, option_value, ordinality * 10
from public.job_questions question
cross join lateral jsonb_array_elements_text(question.options) with ordinality as option(option_value, ordinality)
where not exists (select 1 from public.job_question_options existing where existing.question_id = question.id and existing.value = option_value)
on conflict (question_id, value) do nothing;
