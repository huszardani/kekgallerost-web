"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  applicationStatuses,
  canTransitionJob,
  isValidSlug,
  jobBlockDefinitions,
  jobStatuses,
  legacyQuestionType,
  questionTypes,
  safeAdminReturn
} from "@/lib/recruitment";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ApplicationStatus, JobBlockType, JobStatus, Json, QuestionType } from "@/lib/supabase/database.types";

function requiredText(formData: FormData, key: string, label = key) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${label} megadása kötelező.`);
  return value;
}
function optionalText(formData: FormData, key: string) { const value = String(formData.get(key) ?? "").trim(); return value || null; }
function booleanValue(formData: FormData, key: string) { return formData.get(key) === "on" || formData.get(key) === "true"; }
function optionsValue(formData: FormData, key = "options") { return [...new Set(String(formData.get(key) ?? "").split(/[\n,]/).map((item) => item.trim()).filter(Boolean))]; }
function nullableInteger(formData: FormData, key: string) { const text = String(formData.get(key) ?? "").trim(); if (!text) return null; const value = Number(text); if (!Number.isInteger(value) || value < 0) throw new Error("A fizetési összeg csak pozitív egész szám lehet."); return value; }
function validSlug(value: string) { if (!isValidSlug(value)) throw new Error("A slug csak kisbetűt, számot és kötőjelet tartalmazhat."); return value; }
function limitedText(value: unknown, max = 10000) { return String(value ?? "").trim().slice(0, max) || null; }
function redirectSaved(path: string) { const url = new URL(path, "https://admin.local"); url.searchParams.set("saved", "1"); redirect(`${url.pathname}${url.search}${url.hash}`); }
function revalidateRecruitment() { revalidatePath("/admin", "layout"); revalidatePath("/allasok"); revalidatePath("/allas", "layout"); }

type EditorItemInput = { itemType?: string; title?: string | null; body?: string; sortOrder?: number };
type EditorBlockInput = { type?: string; eyebrow?: string | null; title?: string | null; body?: string | null; visible?: boolean; sortOrder?: number; items?: EditorItemInput[] };
const blockTypes = new Set(jobBlockDefinitions.map((item) => item.type));
function parseEditorBlocks(formData: FormData) {
  let source: unknown;
  try { source = JSON.parse(String(formData.get("content_blocks_json") ?? "[]")); } catch { throw new Error("A tartalmi blokkok formátuma érvénytelen."); }
  if (!Array.isArray(source)) throw new Error("A tartalmi blokkok formátuma érvénytelen.");
  const seen = new Set<string>();
  return (source as EditorBlockInput[]).map((block, index) => {
    if (!block.type || !blockTypes.has(block.type as JobBlockType) || seen.has(block.type)) throw new Error("Érvénytelen vagy ismétlődő tartalmi blokk.");
    seen.add(block.type);
    const items = Array.isArray(block.items) ? block.items.map((item, itemIndex) => ({
      item_type: ["bullet", "highlight", "fact", "faq"].includes(item.itemType ?? "") ? item.itemType as "bullet" | "highlight" | "fact" | "faq" : "bullet" as const,
      title: limitedText(item.title, 300), body: String(item.body ?? "").trim().slice(0, 5000), sort_order: (itemIndex + 1) * 10
    })).filter((item) => item.body) : [];
    return { block_type: block.type as JobBlockType, eyebrow: limitedText(block.eyebrow, 200), title: limitedText(block.title, 300), body: limitedText(block.body), is_visible: Boolean(block.visible), sort_order: (index + 1) * 10, items };
  });
}
function blockText(blocks: ReturnType<typeof parseEditorBlocks>, type: JobBlockType) {
  const block = blocks.find((item) => item.block_type === type);
  return block?.body || block?.items.map((item) => item.body).join("\n") || null;
}

async function saveBlocks(jobId: string, blocks: ReturnType<typeof parseEditorBlocks>) {
  const supabase = await createServerSupabaseClient();
  const { error: deleteError } = await supabase.from("job_content_blocks").delete().eq("job_id", jobId);
  if (deleteError) throw new Error(deleteError.message);
  if (!blocks.length) return;
  const { data: inserted, error } = await supabase.from("job_content_blocks").insert(blocks.map((block) => ({ job_id: jobId, block_type: block.block_type, eyebrow: block.eyebrow, title: block.title, body: block.body, is_visible: block.is_visible, sort_order: block.sort_order }))).select("id, block_type");
  if (error || !inserted) throw new Error(error?.message ?? "A tartalmi blokkok nem menthetők.");
  const ids = new Map(inserted.map((block) => [block.block_type, block.id]));
  const rows = blocks.flatMap((block) => block.items.map((item) => ({ ...item, block_id: ids.get(block.block_type)! })));
  if (rows.length) { const { error: itemsError } = await supabase.from("job_content_items").insert(rows); if (itemsError) throw new Error(itemsError.message); }
}

export type JobEditorActionState = { ok: boolean; error?: string; jobId?: string; savedAt?: string };
export async function saveJobEditorAction(_previous: JobEditorActionState, formData: FormData): Promise<JobEditorActionState> {
  try {
    const profile = await requireRole("admin");
    const supabase = await createServerSupabaseClient();
    const jobId = optionalText(formData, "job_id");
    const title = requiredText(formData, "title", "A pozíció neve").slice(0, 160);
    const slug = validSlug(requiredText(formData, "slug", "A slug"));
    const companyId = requiredText(formData, "company_id", "A cég");
    const blocks = parseEditorBlocks(formData);
    const salaryMin = nullableInteger(formData, "salary_min");
    const salaryMax = nullableInteger(formData, "salary_max");
    if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) throw new Error("A fizetési minimum nem lehet nagyobb a maximumnál.");
    const salaryDisplayMode = requiredText(formData, "salary_display_mode") as "hidden" | "text" | "range";
    if (!["hidden", "text", "range"].includes(salaryDisplayMode)) throw new Error("Érvénytelen fizetés-megjelenítési mód.");
    const { data: slugOwner } = await supabase.from("jobs").select("id").eq("slug", slug).maybeSingle();
    if (slugOwner && slugOwner.id !== jobId) throw new Error("Ez a slug már foglalt. Válassz másik webcímet.");
    const city = optionalText(formData, "city");
    const workplaceAddress = optionalText(formData, "workplace_address");
    const shortDescription = optionalText(formData, "short_description");
    const payload = {
      company_id: companyId, title, slug, employer_label: optionalText(formData, "employer_label"), category: optionalText(formData, "category"),
      city, workplace_address: workplaceAddress, location: [city, workplaceAddress].filter(Boolean).join(" · ") || null,
      work_mode: optionalText(formData, "work_mode"), employment_type: optionalText(formData, "employment_type"), employment_fraction: optionalText(formData, "employment_fraction"),
      work_schedule: optionalText(formData, "work_schedule"), salary_display_mode: salaryDisplayMode, salary_text: optionalText(formData, "salary_text"),
      salary_min: salaryMin, salary_max: salaryMax, salary_currency: (optionalText(formData, "salary_currency") ?? "HUF").slice(0, 3).toUpperCase(),
      salary_period: optionalText(formData, "salary_period") ?? "month", start_date: optionalText(formData, "start_date"),
      application_deadline: optionalText(formData, "application_deadline"), intro_text: optionalText(formData, "intro_text"), short_description: shortDescription,
      summary: shortDescription, hero_image_url: optionalText(formData, "hero_image_url"), resume_enabled: booleanValue(formData, "resume_enabled"),
      description: blockText(blocks, "intro"), tasks: blockText(blocks, "tasks"), requirements: blockText(blocks, "requirements"), advantages: blockText(blocks, "advantages"),
      benefits: blockText(blocks, "benefits"), compensation_details: blockText(blocks, "compensation"), schedule_details: blockText(blocks, "schedule"),
      workplace_details: blockText(blocks, "location"), selection_process: blockText(blocks, "process"), important_information: blockText(blocks, "important"), closing_cta: blockText(blocks, "closing")
    };
    let savedId = jobId;
    if (jobId) {
      const { error } = await supabase.from("jobs").update(payload).eq("id", jobId); if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabase.from("jobs").insert({ ...payload, created_by: profile.id, status: "draft" }).select("id").single();
      if (error || !data) throw new Error(error?.message ?? "Az állás nem hozható létre."); savedId = data.id;
    }
    await saveBlocks(savedId!, blocks);
    revalidateRecruitment();
    return { ok: true, jobId: savedId!, savedAt: new Date().toISOString() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "A mentés nem sikerült." };
  }
}

export async function changeJobStatusAction(formData: FormData) {
  await requireRole("admin");
  const jobId = requiredText(formData, "job_id");
  const nextStatus = requiredText(formData, "status") as JobStatus;
  if (!jobStatuses.some((item) => item.value === nextStatus)) throw new Error("Érvénytelen állásstátusz.");
  const supabase = await createServerSupabaseClient();
  const { data: current, error: readError } = await supabase.from("jobs").select("status, published_at").eq("id", jobId).single();
  if (readError || !current) throw new Error("Az állás nem található.");
  if (!canTransitionJob(current.status, nextStatus)) throw new Error("Ez az állapotváltás nem engedélyezett.");
  const now = new Date().toISOString();
  const payload = {
    status: nextStatus, published_at: nextStatus === "published" ? current.published_at ?? now : current.published_at,
    ready_at: nextStatus === "ready" ? now : null, paused_at: nextStatus === "paused" ? now : null,
    closed_at: nextStatus === "closed" ? now : null, archived_at: nextStatus === "archived" ? now : null,
    scheduled_publish_at: nextStatus === "ready" ? undefined : null
  };
  const { error } = await supabase.from("jobs").update(payload).eq("id", jobId); if (error) throw new Error(error.message);
  revalidateRecruitment(); redirectSaved(safeAdminReturn(formData.get("return_to"), `/admin/allasok/${jobId}`));
}

export async function scheduleJobAction(formData: FormData) {
  await requireRole("admin");
  const jobId = requiredText(formData, "job_id");
  const localTime = requiredText(formData, "scheduled_publish_at", "A publikálás időpontja");
  const scheduled = new Date(localTime);
  if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= Date.now()) throw new Error("A publikálás időpontjának a jövőben kell lennie.");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("jobs").update({ status: "ready", ready_at: new Date().toISOString(), scheduled_publish_at: scheduled.toISOString(), publish_timezone: "Europe/Budapest" }).eq("id", jobId);
  if (error) throw new Error(error.message);
  revalidateRecruitment(); redirectSaved(`/admin/allasok/${jobId}`);
}

export async function duplicateJobAction(formData: FormData) {
  const profile = await requireRole("admin"); const jobId = requiredText(formData, "job_id"); const supabase = await createServerSupabaseClient();
  const [sourceResult, blocksResult, mediaResult, questionsResult] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", jobId).single(), supabase.from("job_content_blocks").select("*").eq("job_id", jobId).order("sort_order"),
    supabase.from("job_media").select("*").eq("job_id", jobId).order("sort_order"), supabase.from("job_questions").select("*").eq("job_id", jobId).order("sort_order")
  ]);
  const source = sourceResult.data; if (!source) throw new Error("A másolandó állás nem található.");
  const suffix = Date.now().toString().slice(-6);
  const copyable = Object.fromEntries(Object.entries(source).filter(([key]) => !["id", "created_at", "updated_at", "published_at", "paused_at", "closed_at", "archived_at", "ready_at", "scheduled_publish_at"].includes(key))) as typeof source;
  const { data: copy, error } = await supabase.from("jobs").insert({ ...copyable, created_by: profile.id, title: `${source.title} – másolat`, slug: `${source.slug}-masolat-${suffix}`, status: "draft", published_at: null, paused_at: null, closed_at: null, archived_at: null, ready_at: null, scheduled_publish_at: null }).select("id").single();
  if (error || !copy) throw new Error(error?.message ?? "Az állás nem másolható.");
  const blocks = blocksResult.data ?? []; const blockIdMap = new Map<string, string>();
  for (const block of blocks) {
    const { data: newBlock, error: blockError } = await supabase.from("job_content_blocks").insert({ job_id: copy.id, block_type: block.block_type, eyebrow: block.eyebrow, title: block.title, body: block.body, is_visible: block.is_visible, sort_order: block.sort_order }).select("id").single();
    if (blockError || !newBlock) throw new Error("A tartalmi blokkok másolása nem sikerült."); blockIdMap.set(block.id, newBlock.id);
  }
  if (blocks.length) {
    const { data: items } = await supabase.from("job_content_items").select("*").in("block_id", blocks.map((block) => block.id));
    if (items?.length) await supabase.from("job_content_items").insert(items.map((item) => ({ block_id: blockIdMap.get(item.block_id)!, item_type: item.item_type, title: item.title, body: item.body, sort_order: item.sort_order })));
  }
  if (mediaResult.data?.length) await supabase.from("job_media").insert(mediaResult.data.map((item) => ({ job_id: copy.id, kind: item.kind, storage_bucket: null, storage_path: null, url: item.url, alt_text: item.alt_text, focus_x: item.focus_x, focus_y: item.focus_y, sort_order: item.sort_order })));
  const questions = questionsResult.data ?? []; const questionIdMap = new Map<string, string>();
  for (const question of questions) {
    const { data: newQuestion, error: questionError } = await supabase.from("job_questions").insert({ job_id: copy.id, question_text: question.question_text, question_type: question.question_type, label: question.label, type: question.type, help_text: question.help_text, internal_note: question.internal_note, is_disqualifying: question.is_disqualifying, options: question.options, is_required: question.is_required, sort_order: question.sort_order }).select("id").single();
    if (questionError || !newQuestion) throw new Error("A kérdések másolása nem sikerült."); questionIdMap.set(question.id, newQuestion.id);
  }
  if (questions.length) {
    const ids = questions.map((question) => question.id); const [options, rules] = await Promise.all([supabase.from("job_question_options").select("*").in("question_id", ids), supabase.from("job_disqualification_rules").select("*").in("question_id", ids)]);
    if (options.data?.length) await supabase.from("job_question_options").insert(options.data.map((item) => ({ question_id: questionIdMap.get(item.question_id)!, value: item.value, label: item.label, sort_order: item.sort_order })));
    if (rules.data?.length) await supabase.from("job_disqualification_rules").insert(rules.data.map((item) => ({ question_id: questionIdMap.get(item.question_id)!, operator: item.operator, values: item.values, target_status: item.target_status })));
  }
  revalidateRecruitment(); redirectSaved(`/admin/allasok/${copy.id}`);
}

export async function saveQuestionAction(formData: FormData) {
  await requireRole("admin"); const jobId = requiredText(formData, "job_id"); const questionId = optionalText(formData, "question_id");
  const questionText = requiredText(formData, "question_text", "A kérdés").slice(0, 500); const questionType = requiredText(formData, "question_type") as QuestionType;
  if (!questionTypes.some((item) => item.value === questionType)) throw new Error("Érvénytelen kérdéstípus.");
  const choiceType = ["radio", "select", "multiselect"].includes(questionType); const options = choiceType ? optionsValue(formData) : [];
  if (choiceType && options.length < 2) throw new Error("A választós kérdéshez legalább két válaszlehetőség szükséges.");
  const disqualifying = booleanValue(formData, "is_disqualifying"); const ruleValues = optionsValue(formData, "disqualifying_answers");
  if (disqualifying && !ruleValues.length) throw new Error("A kizáró kérdésnél add meg a kizárást kiváltó választ.");
  if (choiceType && ruleValues.some((value) => !options.includes(value))) throw new Error("A kizáró válasz csak a megadott válaszlehetőségek egyike lehet.");
  if (questionType === "boolean" && ruleValues.some((value) => !["true", "false"].includes(value))) throw new Error("Igen/nem kérdésnél a kizáró válasz true vagy false lehet.");
  const payload = { job_id: jobId, question_text: questionText, label: questionText, question_type: questionType, type: legacyQuestionType(questionType), help_text: optionalText(formData, "help_text"), internal_note: optionalText(formData, "internal_note"), is_disqualifying: disqualifying, options: options as Json, is_required: booleanValue(formData, "is_required"), sort_order: Math.max(0, Number(formData.get("sort_order") ?? 0) || 0) };
  const supabase = await createServerSupabaseClient();
  const result = questionId ? await supabase.from("job_questions").update(payload).eq("id", questionId).select("id").single() : await supabase.from("job_questions").insert(payload).select("id").single();
  if (result.error || !result.data) throw new Error(result.error?.message ?? "A kérdés nem menthető."); const savedId = result.data.id;
  await supabase.from("job_question_options").delete().eq("question_id", savedId);
  if (options.length) { const { error } = await supabase.from("job_question_options").insert(options.map((value, index) => ({ question_id: savedId, value, label: value, sort_order: (index + 1) * 10 }))); if (error) throw new Error(error.message); }
  if (disqualifying) { const { error } = await supabase.from("job_disqualification_rules").upsert({ question_id: savedId, operator: questionType === "multiselect" ? "contains_any" : "equals", values: ruleValues, target_status: "not_qualified" }, { onConflict: "question_id" }); if (error) throw new Error(error.message); }
  else await supabase.from("job_disqualification_rules").delete().eq("question_id", savedId);
  revalidatePath(`/admin/allasok/${jobId}`); redirectSaved(`/admin/allasok/${jobId}#kerdesek`);
}

export async function deleteQuestionAction(formData: FormData) { await requireRole("admin"); const jobId = requiredText(formData, "job_id"); const supabase = await createServerSupabaseClient(); const { error } = await supabase.from("job_questions").delete().eq("id", requiredText(formData, "question_id")); if (error) throw new Error(error.message); revalidatePath(`/admin/allasok/${jobId}`); redirectSaved(`/admin/allasok/${jobId}#kerdesek`); }

export async function duplicateQuestionAction(formData: FormData) {
  await requireRole("admin"); const jobId = requiredText(formData, "job_id"); const questionId = requiredText(formData, "question_id"); const supabase = await createServerSupabaseClient();
  const [questionResult, optionsResult, ruleResult] = await Promise.all([supabase.from("job_questions").select("*").eq("id", questionId).single(), supabase.from("job_question_options").select("*").eq("question_id", questionId), supabase.from("job_disqualification_rules").select("*").eq("question_id", questionId).maybeSingle()]);
  const source = questionResult.data; if (!source) throw new Error("A kérdés nem található.");
  const { data: copy, error } = await supabase.from("job_questions").insert({ job_id: jobId, question_text: `${source.question_text} – másolat`, question_type: source.question_type, label: `${source.label} – másolat`, type: source.type, help_text: source.help_text, internal_note: source.internal_note, is_disqualifying: source.is_disqualifying, options: source.options, is_required: source.is_required, sort_order: source.sort_order + 1 }).select("id").single();
  if (error || !copy) throw new Error("A kérdés nem másolható.");
  if (optionsResult.data?.length) await supabase.from("job_question_options").insert(optionsResult.data.map((item) => ({ question_id: copy.id, value: item.value, label: item.label, sort_order: item.sort_order })));
  if (ruleResult.data) await supabase.from("job_disqualification_rules").insert({ question_id: copy.id, operator: ruleResult.data.operator, values: ruleResult.data.values, target_status: ruleResult.data.target_status });
  revalidatePath(`/admin/allasok/${jobId}`); redirectSaved(`/admin/allasok/${jobId}#kerdesek`);
}

export async function moveQuestionAction(formData: FormData) {
  await requireRole("admin"); const jobId = requiredText(formData, "job_id"); const questionId = requiredText(formData, "question_id"); const direction = requiredText(formData, "direction"); const supabase = await createServerSupabaseClient();
  const { data: questions } = await supabase.from("job_questions").select("id, sort_order").eq("job_id", jobId).order("sort_order"); const index = questions?.findIndex((item) => item.id === questionId) ?? -1; const target = direction === "up" ? index - 1 : index + 1;
  if (!questions || index < 0 || target < 0 || target >= questions.length) redirect(`/admin/allasok/${jobId}#kerdesek`);
  const current = questions[index]; const other = questions[target]; await supabase.from("job_questions").update({ sort_order: other.sort_order }).eq("id", current.id); await supabase.from("job_questions").update({ sort_order: current.sort_order }).eq("id", other.id);
  revalidatePath(`/admin/allasok/${jobId}`); redirect(`/admin/allasok/${jobId}#kerdesek`);
}

export async function updateApplicationStatusAction(formData: FormData) { await requireRole("admin"); const applicationId = requiredText(formData, "application_id"); const status = requiredText(formData, "status") as ApplicationStatus; if (!applicationStatuses.some((item) => item.value === status)) throw new Error("Érvénytelen CRM-státusz."); const supabase = await createServerSupabaseClient(); const { error } = await supabase.from("applications").update({ status, viewed_at: status === "new" ? null : new Date().toISOString() }).eq("id", applicationId); if (error) throw new Error(error.message); revalidatePath("/admin", "layout"); redirectSaved(safeAdminReturn(formData.get("return_to"), `/admin/jelentkezok/${applicationId}`)); }
export async function addApplicationNoteAction(formData: FormData) { const profile = await requireRole("admin"); const applicationId = requiredText(formData, "application_id"); const content = requiredText(formData, "content", "A megjegyzés"); if (content.length > 5000) throw new Error("A megjegyzés legfeljebb 5000 karakter lehet."); const supabase = await createServerSupabaseClient(); const { data: note, error } = await supabase.from("application_notes").insert({ application_id: applicationId, content, created_by: profile.id }).select("id").single(); if (error || !note) throw new Error(error?.message ?? "A megjegyzés nem menthető."); await supabase.from("activity_logs").insert({ entity_type: "note", entity_id: note.id, action: "created", new_value: applicationId, actor_id: profile.id }); revalidatePath(`/admin/jelentkezok/${applicationId}`); redirectSaved(`/admin/jelentkezok/${applicationId}#megjegyzesek`); }
export async function saveCompanyAction(formData: FormData) { await requireRole("admin"); const companyId = optionalText(formData, "company_id"); const payload = { name: requiredText(formData, "name", "A cégnév"), slug: validSlug(requiredText(formData, "slug", "A slug")), description: optionalText(formData, "description"), contact_email: optionalText(formData, "contact_email"), contact_phone: optionalText(formData, "contact_phone"), website_url: optionalText(formData, "website_url"), logo_url: optionalText(formData, "logo_url"), status: requiredText(formData, "status") as "active" | "inactive" }; const supabase = await createServerSupabaseClient(); const result = companyId ? await supabase.from("companies").update(payload).eq("id", companyId) : await supabase.from("companies").insert(payload); if (result.error) throw new Error(result.error.message); revalidatePath("/admin/cegek"); redirectSaved("/admin/cegek"); }
export async function saveEmailTemplateAction(formData: FormData) { const profile = await requireRole("admin"); const subject = requiredText(formData, "subject", "A tárgy"); if (!subject.includes("{{job_title}}")) throw new Error("A tárgynak tartalmaznia kell a {{job_title}} változót."); const supabase = await createServerSupabaseClient(); const { error } = await supabase.from("email_templates").update({ subject, intro_text: requiredText(formData, "intro_text", "A bevezető"), next_step_text: requiredText(formData, "next_step_text", "A következő lépés"), contact_details: requiredText(formData, "contact_details", "A kapcsolattartási adatok"), signature: requiredText(formData, "signature", "Az aláírás"), updated_by: profile.id }).eq("id", "application_confirmation"); if (error) throw new Error(error.message); revalidatePath("/admin/email-sablon"); redirectSaved("/admin/email-sablon"); }
