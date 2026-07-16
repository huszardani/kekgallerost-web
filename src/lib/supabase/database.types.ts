export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ApplicationStatus =
  | "new"
  | "contacted"
  | "no_answer"
  | "suitable"
  | "not_suitable"
  | "second_call"
  | "callback_needed"
  | "hired"
  | "rejected";

export type JobStatus = "draft" | "published" | "closed" | "archived";

export type QuestionType =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "boolean"
  | "file"
  | "phone"
  | "email";

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
  status: JobStatus;
  created_by: string | null;
  requirements: string | null;
  benefits: string | null;
  start_date_text: string | null;
  application_deadline: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

type JobQuestionRow = {
  id: string;
  job_id: string;
  question_text: string;
  question_type: QuestionType;
  label: string;
  type:
    | "short_text"
    | "long_text"
    | "single_choice"
    | "multi_choice"
    | "yes_no"
    | "number"
    | "file";
  help_text: string | null;
  options: Json;
  is_required: boolean;
  sort_order: number;
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
  source: string;
  submitted_at: string;
  created_at: string;
  updated_at: string;
};

type ApplicationAnswerRow = {
  id: string;
  application_id: string;
  question_id: string;
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
  status: "queued" | "sent" | "failed";
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
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
      companies: TableDefinition<
        CompanyRow,
        Partial<Omit<CompanyRow, "id" | "created_at" | "updated_at" | "is_active">> &
          Pick<CompanyRow, "name" | "slug">
      >;
      profiles: TableDefinition<
        ProfileRow,
        Partial<Omit<ProfileRow, "created_at" | "updated_at" | "is_active">> &
          Pick<ProfileRow, "id" | "email" | "role">
      >;
      jobs: TableDefinition<
        JobRow,
        Partial<Omit<JobRow, "id" | "created_at" | "updated_at">> &
          Pick<JobRow, "company_id" | "title" | "slug">
      >;
      job_questions: TableDefinition<
        JobQuestionRow,
        Partial<Omit<JobQuestionRow, "id" | "created_at" | "updated_at">> &
          Pick<JobQuestionRow, "job_id" | "question_text" | "question_type" | "label" | "type">
      >;
      applications: TableDefinition<
        ApplicationRow,
        Partial<Omit<ApplicationRow, "id" | "created_at" | "updated_at" | "submitted_at">> &
          Pick<
            ApplicationRow,
            | "job_id"
            | "applicant_name"
            | "applicant_email"
            | "candidate_name"
            | "candidate_email"
          >
      >;
      application_answers: TableDefinition<
        ApplicationAnswerRow,
        Partial<Omit<ApplicationAnswerRow, "id" | "created_at">> &
          Pick<ApplicationAnswerRow, "application_id" | "question_id">
      >;
      uploaded_files: TableDefinition<
        UploadedFileRow,
        Partial<Omit<UploadedFileRow, "id" | "created_at">> &
          Pick<
            UploadedFileRow,
            | "application_id"
            | "storage_bucket"
            | "storage_path"
            | "original_filename"
            | "bucket"
            | "path"
          >
      >;
      email_logs: TableDefinition<
        EmailLogRow,
        Partial<Omit<EmailLogRow, "id" | "created_at">> &
          Pick<EmailLogRow, "to_email" | "subject">
      >;
    };
    Views: Record<string, never>;
    Functions: {
      current_user_company_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_partner_for_company: {
        Args: { target_company_id: string };
        Returns: boolean;
      };
      partner_update_application: {
        Args: {
          p_application_id: string;
          p_status: string | null;
          p_partner_note: string | null;
          p_callback_at: string | null;
          p_last_contacted_at: string | null;
        };
        Returns: ApplicationRow;
      };
    };
    Enums: {
      app_role: "admin" | "partner";
      question_type:
        | "short_text"
        | "long_text"
        | "single_choice"
        | "multi_choice"
        | "yes_no"
        | "number"
        | "file";
      email_log_status: "queued" | "sent" | "failed";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Company = CompanyRow;
export type Profile = ProfileRow;
export type Job = JobRow;
export type JobQuestion = JobQuestionRow;
export type Application = ApplicationRow;
export type ApplicationAnswer = ApplicationAnswerRow;
export type UploadedFile = UploadedFileRow;

