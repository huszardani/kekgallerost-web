import { NextResponse } from "next/server";
import { activateScheduledJobs } from "@/lib/job-data";
import { sendApplicationConfirmationEmail } from "@/lib/email/application-confirmation";
import { answerMatchesRule, isAllowedGeneralFile, isAllowedResume, sanitizeFilename } from "@/lib/recruitment";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { Json, JobQuestion } from "@/lib/supabase/database.types";

function textValue(formData: FormData, key: string, max = 5000) { return String(formData.get(key) ?? "").trim().slice(0, max); }
function answerFor(question: JobQuestion, formData: FormData): { text: string | null; json: Json | null; comparable: string | string[] | boolean | null } {
  const key = `question_${question.id}`;
  if (question.question_type === "multiselect") {
    const values = formData.getAll(key).map(String).map((value) => value.trim()).filter(Boolean);
    return { text: null, json: values, comparable: values };
  }
  const value = textValue(formData, key);
  if (question.question_type === "boolean" || question.question_type === "checkbox") {
    const bool = value ? value === "true" : null;
    return { text: value || null, json: bool, comparable: bool };
  }
  return { text: value || null, json: null, comparable: value || null };
}
function isMissingRequired(question: JobQuestion, formData: FormData) {
  if (!question.is_required) return false;
  if (question.question_type === "file" || question.question_type === "resume") { const value = formData.get(`file_${question.id}`); return !(value instanceof File) || value.size === 0; }
  const answer = answerFor(question, formData); return answer.text === null && (!Array.isArray(answer.json) || answer.json.length === 0);
}
function matchesExtension(file: File) {
  const name = file.name.toLowerCase();
  return (file.type === "application/pdf" && name.endsWith(".pdf"))
    || (file.type === "application/msword" && name.endsWith(".doc"))
    || (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && name.endsWith(".docx"))
    || (file.type === "image/jpeg" && (name.endsWith(".jpg") || name.endsWith(".jpeg")))
    || (file.type === "image/png" && name.endsWith(".png"));
}
function matchesSignature(file: File, buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer.slice(0, 12));
  if (file.type === "application/pdf") return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (file.type === "application/msword") return [0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].every((value, index) => bytes[index] === value);
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return bytes[0] === 0x50 && bytes[1] === 0x4b && [[0x03,0x04],[0x05,0x06],[0x07,0x08]].some(([a,b]) => bytes[2] === a && bytes[3] === b);
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value, index) => bytes[index] === value);
  return false;
}

export async function POST(request: Request) {
  let formData: FormData;
  try { formData = await request.formData(); } catch { return NextResponse.json({ error: "Érvénytelen űrlap." }, { status: 400 }); }
  if (textValue(formData, "website")) return NextResponse.json({ ok: true }, { status: 201 });
  const jobId = textValue(formData, "job_id", 100);
  const applicantName = textValue(formData, "applicant_name", 150);
  const applicantEmail = textValue(formData, "applicant_email", 254).toLowerCase();
  const applicantPhone = textValue(formData, "applicant_phone", 50) || null;
  const consentAccepted = formData.get("consent_accepted") === "on";
  if (!jobId || !applicantName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicantEmail) || !consentAccepted) return NextResponse.json({ error: "A név, az érvényes e-mail-cím és az adatkezelési hozzájárulás kötelező." }, { status: 400 });

  await activateScheduledJobs();
  const supabase = createServiceSupabaseClient();
  const { data: job, error: jobError } = await supabase.from("jobs").select("*").eq("id", jobId).eq("status", "published").single();
  if (jobError || !job) return NextResponse.json({ error: "Ez az állás jelenleg nem fogad jelentkezést." }, { status: 404 });
  if (job.application_deadline && Date.now() > new Date(`${job.application_deadline}T23:59:59+02:00`).getTime()) return NextResponse.json({ error: "A jelentkezési határidő lejárt." }, { status: 409 });
  const { data: duplicate } = await supabase.from("applications").select("id").eq("job_id", job.id).eq("applicant_email", applicantEmail).gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()).limit(1);
  if (duplicate?.length) return NextResponse.json({ error: "Erre az állásra ezzel az e-mail-címmel néhány percen belül már érkezett jelentkezés." }, { status: 429 });

  const { data: questions, error: questionsError } = await supabase.from("job_questions").select("*").eq("job_id", job.id).order("sort_order");
  if (questionsError) return NextResponse.json({ error: "A jelentkezési kérdések nem tölthetők be." }, { status: 500 });
  const questionIds = questions.map((question) => question.id);
  const [optionsResult, rulesResult] = questionIds.length ? await Promise.all([
    supabase.from("job_question_options").select("*").in("question_id", questionIds).order("sort_order"),
    supabase.from("job_disqualification_rules").select("*").in("question_id", questionIds)
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (optionsResult.error || rulesResult.error) return NextResponse.json({ error: "A jelentkezési feltételek nem tölthetők be." }, { status: 500 });

  const missing = questions.find((question) => isMissingRequired(question, formData));
  if (missing) return NextResponse.json({ error: `Kötelező mező: ${missing.question_text}` }, { status: 400 });
  for (const question of questions.filter((item) => ["radio", "select", "multiselect"].includes(item.question_type))) {
    const allowed = (optionsResult.data ?? []).filter((option) => option.question_id === question.id).map((option) => option.value);
    const answer = answerFor(question, formData).comparable;
    const values = Array.isArray(answer) ? answer : answer === null ? [] : [String(answer)];
    if (values.some((value) => !allowed.includes(value))) return NextResponse.json({ error: `Érvénytelen válasz: ${question.question_text}` }, { status: 400 });
  }

  const pendingFiles: Array<{ file: File; question: JobQuestion | null; buffer: ArrayBuffer; resume: boolean }> = [];
  for (const question of questions.filter((item) => item.question_type === "file" || item.question_type === "resume")) {
    const file = formData.get(`file_${question.id}`);
    if (file instanceof File && file.size > 0) pendingFiles.push({ file, question, buffer: await file.arrayBuffer(), resume: question.question_type === "resume" });
  }
  const resume = formData.get("resume_file");
  if (resume instanceof File && resume.size > 0) {
    if (!job.resume_enabled) return NextResponse.json({ error: "Ehhez az álláshoz nem tölthető fel önéletrajz." }, { status: 400 });
    pendingFiles.push({ file: resume, question: null, buffer: await resume.arrayBuffer(), resume: true });
  }
  for (const item of pendingFiles) {
    const allowed = item.resume ? isAllowedResume(item.file) : isAllowedGeneralFile(item.file);
    if (!allowed || !matchesExtension(item.file) || !matchesSignature(item.file, item.buffer)) return NextResponse.json({ error: `A(z) ${item.file.name} fájl típusa vagy mérete nem engedélyezett.` }, { status: 400 });
  }

  const disqualified = (rulesResult.data ?? []).some((rule) => {
    const question = questions.find((item) => item.id === rule.question_id);
    if (!question || !question.is_disqualifying) return false;
    const values = Array.isArray(rule.values) ? rule.values.filter((value): value is string => typeof value === "string") : [];
    return answerMatchesRule(answerFor(question, formData).comparable, values);
  });

  const now = new Date().toISOString();
  const { data: application, error: applicationError } = await supabase.from("applications").insert({
    job_id: job.id, applicant_name: applicantName, applicant_email: applicantEmail, applicant_phone: applicantPhone,
    candidate_name: applicantName, candidate_email: applicantEmail, candidate_phone: applicantPhone,
    status: disqualified ? "not_qualified" : "new", source: "website", consent_accepted: true,
    consent_privacy: true, privacy_accepted_at: now
  }).select("id").single();
  if (applicationError || !application) return NextResponse.json({ error: "A jelentkezés nem menthető. Kérjük, próbáld újra." }, { status: 500 });

  const uploadedPaths: string[] = [];
  try {
    const answerRows = questions.filter((question) => question.question_type !== "file" && question.question_type !== "resume").map((question) => {
      const answer = answerFor(question, formData);
      return { application_id: application.id, question_id: question.id, question_label_snapshot: question.question_text, answer_text: answer.text, answer_json: answer.json };
    }).filter((answer) => answer.answer_text !== null || answer.answer_json !== null);
    if (answerRows.length) { const { error } = await supabase.from("application_answers").insert(answerRows); if (error) throw error; }
    for (const { question, file, buffer } of pendingFiles) {
      const storedFilename = `${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
      const storagePath = `applications/${application.id}/${storedFilename}`;
      const { error: uploadError } = await supabase.storage.from("application-files").upload(storagePath, buffer, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      uploadedPaths.push(storagePath);
      const { error: metadataError } = await supabase.from("uploaded_files").insert({ application_id: application.id, storage_bucket: "application-files", storage_path: storagePath, bucket: "application-files", path: storagePath, original_filename: file.name.slice(0, 255), mime_type: file.type, file_size: file.size, size_bytes: file.size });
      if (metadataError) throw metadataError;
      if (question) { const { error: answerError } = await supabase.from("application_answers").insert({ application_id: application.id, question_id: question.id, question_label_snapshot: question.question_text, answer_text: file.name.slice(0, 255), answer_json: { uploaded: true } }); if (answerError) throw answerError; }
    }
  } catch (error) {
    console.error("Application persistence failed", error instanceof Error ? error.message : "unknown error");
    if (uploadedPaths.length) await supabase.storage.from("application-files").remove(uploadedPaths);
    await supabase.from("applications").delete().eq("id", application.id);
    return NextResponse.json({ error: "A jelentkezés mentése megszakadt. Kérjük, próbáld újra." }, { status: 500 });
  }
  const email = await sendApplicationConfirmationEmail({ id: application.id });
  return NextResponse.json({ ok: true, applicationId: application.id, emailStatus: email.status }, { status: 201 });
}
