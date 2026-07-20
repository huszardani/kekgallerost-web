export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ApplicationStatus =
  | "new"
  | "reviewed"
  | "contacted"
  | "interview"
  | "hired"
  | "rejected"
  | "withdrawn"
  | "not_qualified";

export type JobStatus = "draft" | "ready" | "published" | "paused" | "closed" | "archived";

export type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "radio"
  | "select"
  | "multiselect"
  | "checkbox"
  | "date"
  | "boolean"
  | "file"
  | "resume"
  | "phone"
  | "email";

export type JobBlockType =
  | "intro"
  | "role"
  | "fit"
  | "tasks"
  | "requirements"
  | "advantages"
  | "benefits"
  | "compensation"
  | "schedule"
  | "location"
  | "process"
  | "company"
  | "faq"
  | "important"
  | "closing";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: "active" | "inactive";
  billing_name: string | null;
  tax_number: string | null;
  website_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "partner";
  company_id: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type JobRow = {
  id: string;
  company_id: string;
  title: string;
  slug: string;
  short_description: string | null;
  summary: string | null;
  description: string | null;
  location: string | null;
  employment_type: string | null;
  salary_text: string | null;
  hero_image_url: string | null;
  category: string | null;
  work_mode: string | null;
  work_schedule: string | null;
  tasks: string | null;
  requirements: string | null;
  advantages: string | null;
  benefits: string | null;
  important_information: string | null;
  start_date: string | null;
  start_date_text: string | null;
  application_deadline: string | null;
  resume_enabled: boolean;
  employer_label: string | null;
  city: string | null;
  workplace_address: string | null;
  employment_fraction: string | null;
  salary_display_mode: "hidden" | "text" | "range";
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_period: string;
  intro_text: string | null;
  compensation_details: string | null;
  schedule_details: string | null;
  workplace_details: string | null;
  selection_process: string | null;
  closing_cta: string | null;
  hero_image_alt: string | null;
  hero_focus_x: number;
  hero_focus_y: number;
  social_image_url: string | null;
  scheduled_publish_at: string | null;
  publish_timezone: string;
  ready_at: string | null;
  archived_at: string | null;
  status: JobStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  paused_at: string | null;
  closed_at: string | null;
};

type JobContentBlockRow = {
  id: string;
  job_id: string;
  block_type: JobBlockType;
  eyebrow: string | null;
  title: string | null;
  body: string | null;
  is_visible: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type JobContentItemRow = {
  id: string;
  block_id: string;
  item_type: "bullet" | "highlight" | "fact" | "faq";
  title: string | null;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type JobMediaRow = {
  id: string;
  job_id: string;
  kind: "hero" | "gallery" | "social";
  storage_bucket: string | null;
  storage_path: string | null;
  url: string;
  alt_text: string;
  focus_x: number;
  focus_y: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type JobQuestionRow = {
  id: string;
  job_id: string;
  question_text: string;
  question_type: QuestionType;
  label: string;
  type: "short_text" | "long_text" | "single_choice" | "multi_choice" | "yes_no" | "number" | "file";
  help_text: string | null;
  internal_note: string | null;
  is_disqualifying: boolean;
  options: Json;
  is_required: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type JobQuestionOptionRow = {
  id: string;
  question_id: string;
  value: string;
  label: string;
  sort_order: number;
  created_at: string;
};

type JobDisqualificationRuleRow = {
  id: string;
  question_id: string;
  operator: "equals" | "contains_any";
  values: Json;
  target_status: "not_qualified";
  created_at: string;
  updated_at: string;
};

type ApplicationRow = {
  id: string;
  job_id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string | null;
  message: string | null;
  status: ApplicationStatus;
  partner_note: string | null;
  callback_at: string | null;
  last_contacted_at: string | null;
  consent_accepted: boolean;
  consent_privacy: boolean;
  privacy_accepted_at: string | null;
  viewed_at: string | null;
  source: string;
  submitted_at: string;
  created_at: string;
  updated_at: string;
};

type ApplicationAnswerRow = {
  id: string;
  application_id: string;
  question_id: string | null;
  question_label_snapshot: string;
  answer_text: string | null;
  answer_json: Json | null;
  created_at: string;
};

type UploadedFileRow = {
  id: string;
  application_id: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  file_size: number | null;
  bucket: string;
  path: string;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
};

type EmailLogRow = {
  id: string;
  application_id: string | null;
  company_id: string | null;
  provider: string;
  provider_message_id: string | null;
  from_email: string;
  to_email: string;
  subject: string;
  template_key: string | null;
  delivery_key: string | null;
  status: "queued" | "sent" | "failed";
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
};

type ApplicationNoteRow = {
  id: string;
  application_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ActivityLogRow = {
  id: string;
  entity_type: "job" | "application" | "note" | "email" | "company";
  entity_id: string;
  action: string;
  previous_value: string | null;
  new_value: string | null;
  actor_id: string | null;
  created_at: string;
};

type EmailTemplateRow = {
  id: string;
  subject: string;
  intro_text: string;
  next_step_text: string;
  contact_details: string;
  signature: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type TableDefinition<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      companies: TableDefinition<CompanyRow, Partial<Omit<CompanyRow, "id" | "created_at" | "updated_at" | "is_active">> & Pick<CompanyRow, "name" | "slug">>;
      profiles: TableDefinition<ProfileRow, Partial<Omit<ProfileRow, "created_at" | "updated_at" | "is_active">> & Pick<ProfileRow, "id" | "email" | "role">>;
      jobs: TableDefinition<JobRow, Partial<Omit<JobRow, "id" | "created_at" | "updated_at">> & Pick<JobRow, "company_id" | "title" | "slug">>;
      job_content_blocks: TableDefinition<JobContentBlockRow, Partial<Omit<JobContentBlockRow, "id" | "created_at" | "updated_at">> & Pick<JobContentBlockRow, "job_id" | "block_type">>;
      job_content_items: TableDefinition<JobContentItemRow, Partial<Omit<JobContentItemRow, "id" | "created_at" | "updated_at">> & Pick<JobContentItemRow, "block_id" | "body">>;
      job_media: TableDefinition<JobMediaRow, Partial<Omit<JobMediaRow, "id" | "created_at" | "updated_at">> & Pick<JobMediaRow, "job_id" | "kind" | "url">>;
      job_questions: TableDefinition<JobQuestionRow, Partial<Omit<JobQuestionRow, "id" | "created_at" | "updated_at">> & Pick<JobQuestionRow, "job_id" | "question_text" | "question_type" | "label" | "type">>;
      job_question_options: TableDefinition<JobQuestionOptionRow, Partial<Omit<JobQuestionOptionRow, "id" | "created_at">> & Pick<JobQuestionOptionRow, "question_id" | "value" | "label">>;
      job_disqualification_rules: TableDefinition<JobDisqualificationRuleRow, Partial<Omit<JobDisqualificationRuleRow, "id" | "created_at" | "updated_at">> & Pick<JobDisqualificationRuleRow, "question_id" | "values">>;
      applications: TableDefinition<ApplicationRow, Partial<Omit<ApplicationRow, "id" | "created_at" | "updated_at" | "submitted_at">> & Pick<ApplicationRow, "job_id" | "applicant_name" | "applicant_email" | "candidate_name" | "candidate_email">>;
      application_answers: TableDefinition<ApplicationAnswerRow, Partial<Omit<ApplicationAnswerRow, "id" | "created_at">> & Pick<ApplicationAnswerRow, "application_id" | "question_label_snapshot">>;
      uploaded_files: TableDefinition<UploadedFileRow, Partial<Omit<UploadedFileRow, "id" | "created_at">> & Pick<UploadedFileRow, "application_id" | "storage_bucket" | "storage_path" | "original_filename" | "bucket" | "path">>;
      email_logs: TableDefinition<EmailLogRow, Partial<Omit<EmailLogRow, "id" | "created_at">> & Pick<EmailLogRow, "to_email" | "subject">>;
      application_notes: TableDefinition<ApplicationNoteRow, Partial<Omit<ApplicationNoteRow, "id" | "created_at" | "updated_at">> & Pick<ApplicationNoteRow, "application_id" | "content">>;
      activity_logs: TableDefinition<ActivityLogRow, Partial<Omit<ActivityLogRow, "id" | "created_at">> & Pick<ActivityLogRow, "entity_type" | "entity_id" | "action">>;
      email_templates: TableDefinition<EmailTemplateRow, Partial<Omit<EmailTemplateRow, "created_at" | "updated_at">> & Pick<EmailTemplateRow, "id" | "subject" | "intro_text" | "next_step_text" | "contact_details" | "signature">>;
    };
    Views: Record<string, never>;
    Functions: {
      activate_scheduled_jobs: { Args: Record<PropertyKey, never>; Returns: number };
      current_user_company_id: { Args: Record<PropertyKey, never>; Returns: string | null };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_partner_for_company: { Args: { target_company_id: string }; Returns: boolean };
      partner_update_application: { Args: { p_application_id: string; p_status: string | null; p_partner_note: string | null; p_callback_at: string | null; p_last_contacted_at: string | null }; Returns: ApplicationRow };
    };
    Enums: {
      app_role: "admin" | "partner";
      question_type: "short_text" | "long_text" | "single_choice" | "multi_choice" | "yes_no" | "number" | "file";
      email_log_status: "queued" | "sent" | "failed";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Company = CompanyRow;
export type Profile = ProfileRow;
export type Job = JobRow;
export type JobContentBlock = JobContentBlockRow;
export type JobContentItem = JobContentItemRow;
export type JobMedia = JobMediaRow;
export type JobQuestion = JobQuestionRow;
export type JobQuestionOption = JobQuestionOptionRow;
export type JobDisqualificationRule = JobDisqualificationRuleRow;
export type Application = ApplicationRow;
export type ApplicationAnswer = ApplicationAnswerRow;
export type UploadedFile = UploadedFileRow;
export type ApplicationNote = ApplicationNoteRow;
export type ActivityLog = ActivityLogRow;
export type EmailTemplate = EmailTemplateRow;
