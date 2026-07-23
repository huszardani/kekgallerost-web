create extension if not exists pgcrypto;

create table if not exists public.company_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'new',
  source text not null default 'company_interest_form',
  request_id uuid not null unique,
  company text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  call_time text,
  role text not null,
  headcount integer not null check (headcount > 0),
  location text not null,
  start_urgency text not null,
  shifts text[] not null check (cardinality(shifts) > 0),
  has_salary text not null,
  salary text,
  requirements text[] not null default '{}',
  must_know text,
  main_problems text[] not null check (cardinality(main_problems) > 0),
  advertised_before text,
  package text,
  notes text
);

comment on table public.company_leads is 'Céges érdeklődői űrlapról, szerveroldalon mentett leadek.';
comment on column public.company_leads.request_id is 'Kliensenként egyedi idempotenciakulcs a dupla rekordok megelőzésére.';

alter table public.company_leads enable row level security;
revoke all on table public.company_leads from anon, authenticated;
grant select, insert on table public.company_leads to service_role;