-- Optional local/demo seed. Never use these credentials in production.
-- Run after all migrations with `supabase db reset` or `supabase seed`.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'admin.demo@example.com',
    crypt('DemoAdmin-ChangeMe-2026!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Demo Admin"}'::jsonb, now(), now(), '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'partner.demo@example.com',
    crypt('DemoPartner-ChangeMe-2026!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Demo Partner"}'::jsonb, now(), now(), '', '', ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
values
  (
    '11000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin.demo@example.com"}'::jsonb,
    'email', now(), now(), now()
  ),
  (
    '21000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '{"sub":"20000000-0000-4000-8000-000000000001","email":"partner.demo@example.com"}'::jsonb,
    'email', now(), now(), now()
  )
on conflict (provider_id, provider) do nothing;

insert into public.companies (
  id, name, slug, description, contact_email, contact_phone, status
)
values (
  '30000000-0000-4000-8000-000000000001',
  'Minta Logisztika Kft.',
  'minta-logisztika',
  'Kizárólag helyi fejlesztéshez használt demo cég.',
  'kapcsolat@example.com',
  '+36 1 555 0100',
  'active'
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status;

insert into public.profiles (id, email, full_name, role, company_id)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'admin.demo@example.com', 'Demo Admin', 'admin', null
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    'partner.demo@example.com', 'Demo Partner', 'partner',
    '30000000-0000-4000-8000-000000000001'
  )
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  company_id = excluded.company_id;

insert into public.jobs (
  id, company_id, created_by, title, slug, short_description, summary,
  description, location, employment_type, salary_text, status, published_at
)
values (
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Demo raktári munkatárs',
  'demo-raktari-munkatars',
  'Demo állás a jelentkezési folyamat kipróbálásához.',
  'Demo állás a jelentkezési folyamat kipróbálásához.',
  'Ez a hirdetés kizárólag helyi fejlesztési és RLS tesztelési célra készült.',
  'Budapest', 'Teljes munkaidő', 'Bruttó 500 000 Ft/hó',
  'published', now()
)
on conflict (id) do update set
  status = excluded.status,
  published_at = excluded.published_at;

insert into public.job_questions (
  id, job_id, question_text, label, question_type, type, options,
  is_required, sort_order
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'Mikor tudsz kezdeni?', 'Mikor tudsz kezdeni?',
    'text', 'short_text', '[]'::jsonb, true, 10
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    'Melyik műszak megfelelő?', 'Melyik műszak megfelelő?',
    'select', 'single_choice', '["délelőtt","délután","éjszaka"]'::jsonb, true, 20
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000001',
    'Önéletrajz', 'Önéletrajz',
    'file', 'file', '[]'::jsonb, false, 30
  )
on conflict (id) do nothing;

insert into public.applications (
  id, job_id, applicant_name, applicant_email, applicant_phone,
  candidate_name, candidate_email, candidate_phone,
  status, consent_accepted, consent_privacy, partner_note, callback_at
)
values
  (
    '60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'Minta Jelentkező Egy', 'jelentkezo1@example.com', '+36 30 555 0101',
    'Minta Jelentkező Egy', 'jelentkezo1@example.com', '+36 30 555 0101',
    'new', true, true, null, null
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    'Minta Jelentkező Kettő', 'jelentkezo2@example.com', '+36 30 555 0102',
    'Minta Jelentkező Kettő', 'jelentkezo2@example.com', '+36 30 555 0102',
    'contacted', true, true, 'Demo megjegyzés.', null
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000001',
    'Minta Jelentkező Három', 'jelentkezo3@example.com', null,
    'Minta Jelentkező Három', 'jelentkezo3@example.com', null,
    'callback_needed', true, true, null, now() + interval '2 days'
  )
on conflict (id) do nothing;

insert into public.application_answers (
  application_id, question_id, answer_text
)
values
  (
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001', 'Azonnal'
  ),
  (
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002', 'délelőtt'
  )
on conflict (application_id, question_id) do nothing;

