-- Follow-up kept separate so the main CRM migration remains append-only.

alter table public.job_questions drop constraint if exists job_questions_question_type_check;
alter table public.job_questions
  add constraint job_questions_question_type_check
  check (question_type in (
    'text', 'textarea', 'number', 'select', 'multiselect', 'checkbox',
    'date', 'boolean', 'file', 'phone', 'email'
  ));

drop trigger if exists set_application_notes_updated_at on public.application_notes;
create trigger set_application_notes_updated_at
before update on public.application_notes
for each row execute function public.set_updated_at();

drop trigger if exists set_email_templates_updated_at on public.email_templates;
create trigger set_email_templates_updated_at
before update on public.email_templates
for each row execute function public.set_updated_at();
