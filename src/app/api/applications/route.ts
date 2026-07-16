import { NextResponse } from "next/server";
import { sendApplicationConfirmationEmail } from "@/lib/email/application-confirmation";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { Json, JobQuestion } from "@/lib/supabase/database.types";

const maxFileSize = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function safeFilename(filename: string) {
  const normalized = filename.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "").slice(-120) || "feltoltes";
}

function answerFor(question: JobQuestion, formData: FormData): { text: string | null; json: Json | null } {
  const key = `question_${question.id}`;
  if (question.question_type === "multiselect") {
    const values = formData.getAll(key).map(String).map((value) => value.trim()).filter(Boolean);
    return { text: null, json: values };
  }
  const value = textValue(formData, key);
  if (question.question_type === "boolean") {
    return { text: value, json: value ? value === "true" : null };
  }
  return { text: value || null, json: null };
}

function isMissingRequired(question: JobQuestion, formData: FormData) {
  if (!question.is_required) return false;
  if (question.question_type === "file") {
    const value = formData.get(`file_${question.id}`);
    return !(value instanceof File) || value.size === 0;
  }
  const answer = answerFor(question, formData);
  return answer.text === null && (!Array.isArray(answer.json) || answer.json.length === 0);
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Érvénytelen űrlap." }, { status: 400 });
  }

  if (textValue(formData, "website")) {
    return NextResponse.json({ ok: true });
  }

  const jobId = textValue(formData, "job_id");
  const applicantName = textValue(formData, "applicant_name");
  const applicantEmail = textValue(formData, "applicant_email").toLowerCase();
  const applicantPhone = textValue(formData, "applicant_phone") || null;
  const consentAccepted = formData.get("consent_accepted") === "on";
  if (!jobId || !applicantName || !/^\S+@\S+\.\S+$/.test(applicantEmail) || !consentAccepted) {
    return NextResponse.json({ error: "A név, az érvényes e-mail-cím és az adatkezelési hozzájárulás kötelező." }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, company_id, title, status")
    .eq("id", jobId)
    .eq("status", "published")
    .single();
  if (jobError || !job) {
    return NextResponse.json({ error: "Ez az állás nem fogad jelentkezést." }, { status: 404 });
  }

  const { data: questions, error: questionsError } = await supabase
    .from("job_questions")
    .select("*")
    .eq("job_id", job.id)
    .order("sort_order");
  if (questionsError) return NextResponse.json({ error: "A kérdések nem tölthetők be." }, { status: 500 });

  const missing = questions.find((question) => isMissingRequired(question, formData));
  if (missing) return NextResponse.json({ error: `Kötelező mező: ${missing.question_text}` }, { status: 400 });

  const files = questions
    .filter((question) => question.question_type === "file")
    .map((question) => ({ question, file: formData.get(`file_${question.id}`) }))
    .filter((item): item is { question: JobQuestion; file: File } => item.file instanceof File && item.file.size > 0);

  for (const { file } of files) {
    if (file.size > maxFileSize || !allowedMimeTypes.has(file.type)) {
      return NextResponse.json({ error: `Nem engedélyezett vagy túl nagy fájl: ${file.name}` }, { status: 400 });
    }
  }

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .insert({
      job_id: job.id,
      applicant_name: applicantName,
      applicant_email: applicantEmail,
      applicant_phone: applicantPhone,
      candidate_name: applicantName,
      candidate_email: applicantEmail,
      candidate_phone: applicantPhone,
      status: "new",
      source: "website",
      consent_accepted: true,
      consent_privacy: true
    })
    .select("id, applicant_name, applicant_email")
    .single();
  if (applicationError || !application) {
    return NextResponse.json({ error: "A jelentkezés nem menthető." }, { status: 500 });
  }

  const uploadedPaths: string[] = [];
  try {
    const answerRows = questions
      .filter((question) => question.question_type !== "file")
      .map((question) => {
        const answer = answerFor(question, formData);
        return {
          application_id: application.id,
          question_id: question.id,
          answer_text: answer.text,
          answer_json: answer.json
        };
      })
      .filter((answer) => answer.answer_text !== null || answer.answer_json !== null);

    if (answerRows.length) {
      const { error } = await supabase.from("application_answers").insert(answerRows);
      if (error) throw error;
    }

    for (const { question, file } of files) {
      const filename = `${crypto.randomUUID()}-${safeFilename(file.name)}`;
      const storagePath = `applications/${application.id}/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from("application-files")
        .upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      uploadedPaths.push(storagePath);

      const { error: metadataError } = await supabase.from("uploaded_files").insert({
        application_id: application.id,
        storage_bucket: "application-files",
        storage_path: storagePath,
        bucket: "application-files",
        path: storagePath,
        original_filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        size_bytes: file.size
      });
      if (metadataError) throw metadataError;

      const { error: answerError } = await supabase.from("application_answers").insert({
        application_id: application.id,
        question_id: question.id,
        answer_text: file.name,
        answer_json: { uploaded: true }
      });
      if (answerError) throw answerError;
    }
  } catch (error) {
    if (uploadedPaths.length) await supabase.storage.from("application-files").remove(uploadedPaths);
    await supabase.from("applications").delete().eq("id", application.id);
    return NextResponse.json({ error: error instanceof Error ? error.message : "A jelentkezés mentése megszakadt." }, { status: 500 });
  }

  const email = await sendApplicationConfirmationEmail({
    id: application.id,
    applicantName: application.applicant_name,
    applicantEmail: application.applicant_email,
    jobTitle: job.title,
    companyId: job.company_id
  });

  return NextResponse.json({ ok: true, applicationId: application.id, emailStatus: email.status }, { status: 201 });
}

