"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import type { JobStatus, QuestionType } from "@/lib/supabase/database.types";

const jobStatuses: JobStatus[] = ["draft", "published", "closed", "archived"];
const questionTypes: QuestionType[] = [
  "text", "textarea", "select", "multiselect", "boolean", "file", "phone", "email"
];

function requiredText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`A(z) ${key} mező kötelező.`);
  return value;
}

function optionalText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function boolValue(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function legacyQuestionType(type: QuestionType) {
  const map = {
    text: "short_text",
    textarea: "long_text",
    select: "single_choice",
    multiselect: "multi_choice",
    boolean: "yes_no",
    file: "file",
    phone: "short_text",
    email: "short_text"
  } as const;
  return map[type];
}

function parseOptions(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function createCompanyAction(formData: FormData) {
  await requireRole("admin");
  const supabase = await createServerSupabaseClient();
  const status = requiredText(formData, "status") as "active" | "inactive";
  const { error } = await supabase.from("companies").insert({
    name: requiredText(formData, "name"),
    slug: requiredText(formData, "slug"),
    description: optionalText(formData, "description"),
    logo_url: optionalText(formData, "logo_url"),
    cover_image_url: optionalText(formData, "cover_image_url"),
    contact_email: optionalText(formData, "contact_email"),
    contact_phone: optionalText(formData, "contact_phone"),
    status
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function updateCompanyAction(formData: FormData) {
  await requireRole("admin");
  const supabase = await createServerSupabaseClient();
  const status = requiredText(formData, "status") as "active" | "inactive";
  const { error } = await supabase
    .from("companies")
    .update({
      name: requiredText(formData, "name"),
      slug: requiredText(formData, "slug"),
      description: optionalText(formData, "description"),
      logo_url: optionalText(formData, "logo_url"),
      cover_image_url: optionalText(formData, "cover_image_url"),
      contact_email: optionalText(formData, "contact_email"),
      contact_phone: optionalText(formData, "contact_phone"),
      status
    })
    .eq("id", requiredText(formData, "company_id"));
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function invitePartnerAction(formData: FormData) {
  await requireRole("admin");
  const email = requiredText(formData, "email").toLowerCase();
  const fullName = requiredText(formData, "full_name");
  const companyId = requiredText(formData, "company_id");
  const service = createServiceSupabaseClient();
  const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role: "partner" }
  });
  if (error || !data.user) throw new Error(error?.message ?? "A partner meghívása sikertelen.");

  const supabase = await createServerSupabaseClient();
  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    email,
    full_name: fullName,
    role: "partner",
    company_id: companyId
  });

  if (profileError) {
    await service.auth.admin.deleteUser(data.user.id);
    throw new Error(profileError.message);
  }

  revalidatePath("/admin");
}

export async function assignPartnerCompanyAction(formData: FormData) {
  await requireRole("admin");
  const supabase = await createServerSupabaseClient();
  const profileId = requiredText(formData, "profile_id");
  const companyId = requiredText(formData, "company_id");
  const { error } = await supabase
    .from("profiles")
    .update({ company_id: companyId })
    .eq("id", profileId)
    .eq("role", "partner");
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function createJobAction(formData: FormData) {
  const profile = await requireRole("admin");
  const statusValue = requiredText(formData, "status");
  if (!jobStatuses.includes(statusValue as JobStatus)) throw new Error("Érvénytelen állásstátusz.");
  const status = statusValue as JobStatus;
  const shortDescription = optionalText(formData, "short_description");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("jobs").insert({
    company_id: requiredText(formData, "company_id"),
    created_by: profile.id,
    title: requiredText(formData, "title"),
    slug: requiredText(formData, "slug"),
    short_description: shortDescription,
    summary: shortDescription,
    description: optionalText(formData, "description"),
    location: optionalText(formData, "location"),
    employment_type: optionalText(formData, "employment_type"),
    salary_text: optionalText(formData, "salary_text"),
    hero_image_url: optionalText(formData, "hero_image_url"),
    status,
    published_at: status === "published" ? new Date().toISOString() : null
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/allas");
}

export async function updateJobAction(formData: FormData) {
  await requireRole("admin");
  const jobId = requiredText(formData, "job_id");
  const statusValue = requiredText(formData, "status");
  if (!jobStatuses.includes(statusValue as JobStatus)) throw new Error("Érvénytelen állásstátusz.");
  const status = statusValue as JobStatus;
  const shortDescription = optionalText(formData, "short_description");
  const supabase = await createServerSupabaseClient();
  const { data: current } = await supabase.from("jobs").select("published_at").eq("id", jobId).single();
  const { error } = await supabase
    .from("jobs")
    .update({
      company_id: requiredText(formData, "company_id"),
      title: requiredText(formData, "title"),
      slug: requiredText(formData, "slug"),
      short_description: shortDescription,
      summary: shortDescription,
      description: optionalText(formData, "description"),
      location: optionalText(formData, "location"),
      employment_type: optionalText(formData, "employment_type"),
      salary_text: optionalText(formData, "salary_text"),
      hero_image_url: optionalText(formData, "hero_image_url"),
      status,
      published_at: status === "published" ? current?.published_at ?? new Date().toISOString() : null
    })
    .eq("id", jobId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/allas");
}

export async function addQuestionAction(formData: FormData) {
  await requireRole("admin");
  const typeValue = requiredText(formData, "question_type");
  if (!questionTypes.includes(typeValue as QuestionType)) throw new Error("Érvénytelen kérdéstípus.");
  const questionType = typeValue as QuestionType;
  const questionText = requiredText(formData, "question_text");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("job_questions").insert({
    job_id: requiredText(formData, "job_id"),
    question_text: questionText,
    label: questionText,
    question_type: questionType,
    type: legacyQuestionType(questionType),
    options: parseOptions(String(formData.get("options") ?? "")),
    is_required: boolValue(formData, "is_required"),
    sort_order: Number(formData.get("sort_order") ?? 0) || 0
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function updateQuestionAction(formData: FormData) {
  await requireRole("admin");
  const typeValue = requiredText(formData, "question_type");
  if (!questionTypes.includes(typeValue as QuestionType)) throw new Error("Érvénytelen kérdéstípus.");
  const questionType = typeValue as QuestionType;
  const questionText = requiredText(formData, "question_text");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("job_questions")
    .update({
      question_text: questionText,
      label: questionText,
      question_type: questionType,
      type: legacyQuestionType(questionType),
      options: parseOptions(String(formData.get("options") ?? "")),
      is_required: boolValue(formData, "is_required"),
      sort_order: Number(formData.get("sort_order") ?? 0) || 0
    })
    .eq("id", requiredText(formData, "question_id"));
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function deleteQuestionAction(formData: FormData) {
  await requireRole("admin");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("job_questions")
    .delete()
    .eq("id", requiredText(formData, "question_id"));
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

