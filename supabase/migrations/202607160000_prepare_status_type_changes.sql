-- Policies created by the initial migration depend on jobs.status's enum type.
-- Drop them before the canonical migration converts that column to text + CHECK.
-- 202607160001 recreates every affected policy with the final authorization model.

drop policy if exists "Public can read published jobs" on public.jobs;
drop policy if exists "Admins can manage jobs" on public.jobs;
drop policy if exists "Partners can manage company jobs" on public.jobs;

drop policy if exists "Public can read questions for published jobs" on public.job_questions;
drop policy if exists "Admins can manage job questions" on public.job_questions;
drop policy if exists "Partners can manage questions for company jobs" on public.job_questions;

drop policy if exists "Public can create applications for published jobs" on public.applications;
drop policy if exists "Admins can manage applications" on public.applications;
drop policy if exists "Partners can read company applications" on public.applications;
drop policy if exists "Partners can update company application status" on public.applications;

drop policy if exists "Public can create application answers" on public.application_answers;
drop policy if exists "Admins can read application answers" on public.application_answers;
drop policy if exists "Partners can read company application answers" on public.application_answers;

