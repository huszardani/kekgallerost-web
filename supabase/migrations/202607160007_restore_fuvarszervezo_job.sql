-- Restore the original Fuvarszervező vacancy as canonical Supabase content.
-- Idempotent: re-running updates the managed company/job/question records.

insert into public.companies (
  id,
  name,
  slug,
  description,
  status,
  is_active
)
values (
  'f0000000-0000-4000-8000-000000000001',
  'Ellenőrzött fuvarozási partner',
  'ellenorzott-fuvarozasi-partner',
  'Stabil, ellenőrzött fuvarozási partner Nagytarcsán. A csapat belföldi és nemzetközi fuvarokat szervez, átlátható operációval, tiszta felelősségi körökkel és támogató szakmai vezetéssel.',
  'active',
  true
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  status = 'active',
  is_active = true,
  updated_at = now();

insert into public.jobs (
  id,
  company_id,
  created_by,
  title,
  slug,
  short_description,
  summary,
  description,
  location,
  employment_type,
  salary_text,
  hero_image_url,
  status,
  published_at
)
values (
  'f1000000-0000-4000-8000-000000000001',
  (select id from public.companies where slug = 'ellenorzott-fuvarozasi-partner'),
  (select id from public.profiles where role = 'admin' and is_active = true order by created_at limit 1),
  'Fuvarszervező',
  'fuvarszervezo-nagytarcsa',
  'Irodai fuvarszervezői munka Nagytarcsán, stabil fix bérrel és bónuszlehetőséggel.',
  'Irodai fuvarszervezői munka Nagytarcsán, stabil fix bérrel és bónuszlehetőséggel.',
  E'Irodai fuvarszervezői szerep azoknak, akik szeretik a rendszert, a tempót és a tiszta felelősségi köröket.\n\nFŐ FELADATOK\n• Belföldi és nemzetközi fuvarok szervezése, ajánlatkérés és kapacitáslekötés.\n• Fuvarmegbízások, útvonalak, időablakok és rakodási idők egyeztetése.\n• Ügyfél-, sofőr- és alvállalkozói kommunikáció.\n• CMR és kísérő okmányok, engedélyek és státuszok kezelése.\n• Kihasználtság, költség és idő optimalizálása.\n• Reklamációk, késések és váratlan helyzetek operatív kezelése.\n\nELVÁRÁSOK\n• Minimum 2 év fuvarszervezési tapasztalat.\n• Belföldi fuvarokban biztos rutin; nemzetközi tapasztalat előny.\n• Erős szervezői készség és magabiztos kommunikáció.\n• Irodai jelenlét vállalása Nagytarcsán; saját autó előny.\n\nAMIT KÍNÁLUNK\n• Stabil fix bér + célprémium / bónusz.\n• Átlagosan ~650 000 Ft havi jövedelem.\n• Átlátható célok és támogató szakmai vezetés.\n• Első kifizetés az első naptári hónapban.',
  '2142 Nagytarcsa, Naplás út 1.',
  'Teljes munkaidő, hétfő–péntek, irodai munkavégzés',
  'Átlag ~650 000 Ft/hó fix + bónusz',
  '/assets/job-fuvarszervezo-nagytarcsa-custom.png',
  'published',
  now()
)
on conflict (slug) do update
set
  company_id = excluded.company_id,
  created_by = coalesce(jobs.created_by, excluded.created_by),
  title = excluded.title,
  short_description = excluded.short_description,
  summary = excluded.summary,
  description = excluded.description,
  location = excluded.location,
  employment_type = excluded.employment_type,
  salary_text = excluded.salary_text,
  hero_image_url = excluded.hero_image_url,
  status = 'published',
  published_at = coalesce(jobs.published_at, now()),
  updated_at = now();

insert into public.job_questions (
  id,
  job_id,
  question_text,
  question_type,
  options,
  is_required,
  sort_order
)
values
  (
    'f2000000-0000-4000-8000-000000000001',
    (select id from public.jobs where slug = 'fuvarszervezo-nagytarcsa'),
    'Van minimum 2 év fuvarszervezési tapasztalatod?',
    'boolean', '[]'::jsonb, true, 10
  ),
  (
    'f2000000-0000-4000-8000-000000000002',
    (select id from public.jobs where slug = 'fuvarszervezo-nagytarcsa'),
    'Dolgoztál már belföldi vagy nemzetközi fuvarok szervezésével?',
    'textarea', '[]'::jsonb, true, 20
  ),
  (
    'f2000000-0000-4000-8000-000000000003',
    (select id from public.jobs where slug = 'fuvarszervezo-nagytarcsa'),
    'Vállalod az irodai jelenlétet Nagytarcsán?',
    'boolean', '[]'::jsonb, true, 30
  ),
  (
    'f2000000-0000-4000-8000-000000000004',
    (select id from public.jobs where slug = 'fuvarszervezo-nagytarcsa'),
    'Megoldható számodra a napi bejárás, szükség esetén saját autóval?',
    'boolean', '[]'::jsonb, true, 40
  ),
  (
    'f2000000-0000-4000-8000-000000000005',
    (select id from public.jobs where slug = 'fuvarszervezo-nagytarcsa'),
    'Mennyi a jelenlegi vagy elvárt havi jövedelmi sávod?',
    'text', '[]'::jsonb, true, 50
  )
on conflict (id) do update
set
  job_id = excluded.job_id,
  question_text = excluded.question_text,
  question_type = excluded.question_type,
  options = excluded.options,
  is_required = excluded.is_required,
  sort_order = excluded.sort_order,
  updated_at = now();
