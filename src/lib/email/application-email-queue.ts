import "server-only";

import { env } from "@/lib/env";
import {
  ApplicationEmailFailure,
  processClaimedApplicationEmails,
  type ClaimedApplicationEmail,
  type PreparedApplicationEmail,
  type SafeDeliveryFailure,
} from "@/lib/email/application-email-delivery";
import {
  escapeEmailHtml,
  normalizeNotificationEmail,
  planApplicationNotificationMessages,
  type ApplicationNotificationInput,
} from "@/lib/email/application-notification-plan";
import { getEmailFromAddress, sendIdempotentEmail } from "@/lib/email/resend";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

function failure(code: string, message: string, retryable: boolean): ApplicationEmailFailure {
  return new ApplicationEmailFailure({ code, message, retryable });
}

function answerValue(answer: { answer_text: string | null; answer_json: unknown }) {
  if (answer.answer_text?.trim()) return answer.answer_text;
  if (Array.isArray(answer.answer_json)) return answer.answer_json.join(", ") || "Nincs megadva";
  if (typeof answer.answer_json === "boolean") return answer.answer_json ? "Igen" : "Nem";
  if (answer.answer_json && typeof answer.answer_json === "object") return "Dokumentum feltöltve";
  return "Nincs megadva";
}

function htmlText(value: string) {
  return escapeEmailHtml(value).replace(/\n/g, "<br />");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("hu-HU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Budapest",
  }).format(new Date(value));
}

function confirmationMessage(input: ApplicationNotificationInput & {
  job: ApplicationNotificationInput["job"] & { work_schedule: string | null; important_information: string | null };
  company: NonNullable<ApplicationNotificationInput["company"]> & { contact_phone: string | null };
  template: { subject: string; intro_text: string; next_step_text: string; contact_details: string; signature: string } | null;
}): PreparedApplicationEmail {
  const copy = input.template ?? {
    subject: "Jelentkezésed megérkezett – {{job_title}}",
    intro_text: "Köszönjük, hogy jelentkeztél. Az alábbiakban összefoglaljuk a beküldött adataidat.",
    next_step_text: "Munkatársunk hamarosan átnézi a jelentkezésedet, és jelentkezik a megadott elérhetőségeid egyikén.",
    contact_details: "Kérdés esetén írj az info@kekgallerost.hu címre.",
    signature: "Üdvözlettel,\nA Kékgalléros csapata",
  };
  const subject = copy.subject.replaceAll("{{job_title}}", input.job.title).replace(/[\r\n]/g, " ").slice(0, 250);
  const submittedAt = formatDate(input.created_at);
  const answerLines = input.answers.map((answer) => `${answer.question_label_snapshot}: ${answerValue(answer)}`);
  const important = [input.job.work_schedule, input.job.important_information].filter(Boolean).slice(0, 2) as string[];
  const contact = [input.company.contact_email, input.company.contact_phone].filter(Boolean).join(" · ") || copy.contact_details;
  const text = [
    `Kedves ${input.applicant_name}!`, "", copy.intro_text, "",
    `Állás: ${input.job.title}`, `Cég: ${input.company.name}`, `Jelentkezés időpontja: ${submittedAt}`,
    `Név: ${input.applicant_name}`, `E-mail: ${input.applicant_email}`, `Telefonszám: ${input.applicant_phone}`,
    "", "Megadott válaszok:", ...answerLines,
    `Önéletrajz: ${input.files.length ? "sikeresen feltöltve" : "nem került feltöltésre"}`,
    ...(important.length ? ["", "Fontos tudnivalók:", ...important.map((item) => `- ${item}`)] : []),
    "", copy.next_step_text, "", `Kapcsolat: ${contact}`, "", copy.signature,
    "", "Adatvédelmi tájékoztató: a jelentkezésed adatait kizárólag a kiválasztási folyamat céljából kezeljük.",
  ].join("\n");
  const answerHtml = `<h2 style="font-size:18px">Megadott válaszok</h2><dl>${input.answers.map((answer) => `<dt style="font-weight:700;margin-top:10px">${escapeEmailHtml(answer.question_label_snapshot)}</dt><dd style="margin:3px 0 0">${htmlText(answerValue(answer))}</dd>`).join("")}</dl>`;
  const importantHtml = important.length ? `<h2 style="font-size:18px">Fontos tudnivalók</h2><ul>${important.map((item) => `<li>${htmlText(item)}</li>`).join("")}</ul>` : "";
  const html = `<div style="background:#f4f7fb;padding:28px;font-family:Arial,sans-serif;color:#172033"><div style="max-width:680px;margin:auto;background:#fff;border:1px solid #dfe5ed;border-radius:12px;padding:30px"><div style="color:#145da0;font-size:13px;font-weight:700">KÉKGALLÉROS</div><h1 style="font-size:25px">Kedves ${escapeEmailHtml(input.applicant_name)}!</h1><p>${htmlText(copy.intro_text)}</p><div style="background:#f7f9fc;border-radius:8px;padding:18px;margin:20px 0"><strong>${escapeEmailHtml(input.job.title)}</strong><br />${escapeEmailHtml(input.company.name)}<br /><span style="color:#667085">${escapeEmailHtml(submittedAt)}</span></div><h2 style="font-size:18px">Megadott adatok</h2><p>Név: ${escapeEmailHtml(input.applicant_name)}<br />E-mail: ${escapeEmailHtml(input.applicant_email)}<br />Telefonszám: ${escapeEmailHtml(input.applicant_phone ?? "Nincs megadva")}<br />Önéletrajz: ${input.files.length ? "sikeresen feltöltve" : "nem került feltöltésre"}</p>${answerHtml}${importantHtml}<h2 style="font-size:18px">Mi történik ezután?</h2><p>${htmlText(copy.next_step_text)}</p><p>${htmlText(contact)}</p><p>${htmlText(copy.signature)}</p><hr style="border:0;border-top:1px solid #e5e9ef;margin:24px 0" /><p style="color:#667085;font-size:12px">A jelentkezésed adatait kizárólag a kiválasztási folyamat céljából kezeljük. Belső CRM-adatot és feltöltött dokumentumot ez az e-mail nem tartalmaz.</p></div></div>`;
  return { recipient: input.applicant_email, subject, text, html };
}

async function prepareApplicationEmail(delivery: ClaimedApplicationEmail): Promise<PreparedApplicationEmail> {
  const supabase = createServiceSupabaseClient();
  const applicationResult = await supabase.from("applications").select("id, applicant_name, applicant_email, applicant_phone, created_at, job_id").eq("id", delivery.applicationId).single();
  if (applicationResult.error) throw failure("application_lookup_failed", "A jelentkezés adatainak lekérése átmenetileg sikertelen.", true);
  const application = applicationResult.data;
  if (!application?.applicant_name || !normalizeNotificationEmail(application.applicant_email) || !application.applicant_phone || !application.job_id) {
    throw failure("application_data_incomplete", "A jelentkezés kötelező kapcsolati adatai hiányosak.", false);
  }

  const [jobResult, answersResult, filesResult, templateResult] = await Promise.all([
    supabase.from("jobs").select("company_id, title, location, work_schedule, important_information").eq("id", application.job_id).single(),
    supabase.from("application_answers").select("question_label_snapshot, answer_text, answer_json").eq("application_id", application.id).order("created_at"),
    supabase.from("uploaded_files").select("original_filename").eq("application_id", application.id).order("created_at"),
    supabase.from("email_templates").select("subject, intro_text, next_step_text, contact_details, signature").eq("id", "application_confirmation").maybeSingle(),
  ]);
  if (jobResult.error || answersResult.error || filesResult.error || templateResult.error) {
    throw failure("related_data_lookup_failed", "Az e-mailhez szükséges adatok lekérése átmenetileg sikertelen.", true);
  }
  const job = jobResult.data;
  if (!job?.company_id || !job.title) throw failure("job_data_incomplete", "Az álláshirdetés e-mailhez szükséges adatai hiányosak.", false);
  if (!answersResult.data?.length) throw failure("application_answers_missing", "A jelentkezés kérdés- és válaszadatai hiányoznak.", false);

  const companyResult = await supabase.from("companies").select("name, contact_email, contact_phone").eq("id", job.company_id).single();
  if (companyResult.error) throw failure("company_lookup_failed", "A cég adatainak lekérése átmenetileg sikertelen.", true);
  const company = companyResult.data;
  if (!company?.name) throw failure("company_data_incomplete", "A cég e-mailhez szükséges adatai hiányosak.", false);

  const input: ApplicationNotificationInput = {
    ...application,
    job,
    company,
    answers: answersResult.data,
    files: filesResult.data ?? [],
  };
  let message: PreparedApplicationEmail | undefined;
  if (delivery.role === "applicant") {
    message = confirmationMessage({ ...input, job, company, template: templateResult.data });
  } else {
    const plan = planApplicationNotificationMessages({ application: input, adminEmail: env.applicationNotificationAdminEmail, siteUrl: env.siteUrl });
    message = plan.messages.find((item) => item.role === delivery.role);
    if (message) message = { recipient: message.recipient, subject: message.subject, text: message.text, html: message.html, replyTo: message.replyTo };
  }
  if (!message) throw failure("recipient_missing_or_invalid", `A(z) ${delivery.role} címzett hiányzik vagy érvénytelen.`, false);

  const { error: metadataError } = await supabase.from("email_logs").update({ to_email: message.recipient, subject: message.subject }).eq("id", delivery.id).eq("locked_by", delivery.workerId);
  if (metadataError) throw failure("email_log_update_failed", "Az e-mail naplójának frissítése átmenetileg sikertelen.", true);
  return message;
}

function resendFailure(error: unknown): SafeDeliveryFailure {
  const candidate = error as { name?: string; statusCode?: number } | null;
  const status = candidate?.statusCode;
  const code = candidate?.name ?? "resend_request_failed";
  const retryable = status === undefined || status === 408 || status === 409 || status === 429 || status >= 500;
  if (code === "invalid_idempotent_request" || code === "validation_error" || status === 400 || status === 401 || status === 403 || status === 422) {
    return { code: "provider_rejected_permanently", message: "Az e-mail-szolgáltató véglegesen elutasította a kérést.", retryable: false };
  }
  return { code: retryable ? "provider_temporarily_unavailable" : "provider_rejected_permanently", message: retryable ? "Az e-mail-szolgáltató átmenetileg nem elérhető." : "Az e-mail-szolgáltató véglegesen elutasította a kérést.", retryable };
}

async function completeDelivery(delivery: ClaimedApplicationEmail, status: "queued" | "sent" | "failed", values: { messageId?: string | null; failure?: SafeDeliveryFailure; nextAttemptAt?: string | null }) {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.rpc("complete_application_email_delivery", {
    p_email_log_id: delivery.id,
    p_worker_id: delivery.workerId,
    p_status: status,
    p_provider_message_id: values.messageId ?? null,
    p_error_code: values.failure?.code ?? null,
    p_error_message: values.failure?.message ?? null,
    p_next_attempt_at: values.nextAttemptAt ?? null,
  });
  if (error || !data) throw failure("delivery_state_update_failed", "Az e-mail-kézbesítés állapota nem frissíthető.", true);
}

export async function enqueueApplicationEmails(applicationId: string, companyId: string, applicantEmail: string) {
  const supabase = createServiceSupabaseClient();
  const adminEmail = normalizeNotificationEmail(env.applicationNotificationAdminEmail);
  const { data, error } = await supabase.rpc("enqueue_application_email_deliveries", {
    p_application_id: applicationId,
    p_company_id: companyId,
    p_applicant_email: applicantEmail,
    p_admin_email: adminEmail,
    p_from_email: getEmailFromAddress(),
  });
  if (error || data !== true) throw new Error("application_email_queue_failed");
}

export async function processDueApplicationEmails(options: { applicationId?: string; limit?: number } = {}) {
  const supabase = createServiceSupabaseClient();
  const workerId = crypto.randomUUID();
  const { data, error } = await supabase.rpc("claim_due_application_email_deliveries", {
    p_worker_id: workerId,
    p_limit: options.limit ?? 20,
    p_application_id: options.applicationId ?? null,
    p_admin_email: normalizeNotificationEmail(env.applicationNotificationAdminEmail),
    p_from_email: getEmailFromAddress(),
  });
  if (error) throw new Error("application_email_claim_failed");
  const deliveries: ClaimedApplicationEmail[] = (data ?? []).map((item) => ({
    id: item.id,
    applicationId: item.application_id,
    role: item.recipient_role,
    deliveryKey: item.delivery_key,
    attemptCount: item.attempt_count,
    workerId: item.worker_id,
  }));
  if (!deliveries.length) return [];
  return processClaimedApplicationEmails(deliveries, {
    prepare: prepareApplicationEmail,
    send: async (delivery, message) => {
      if (!env.resendApiKey) throw new ApplicationEmailFailure({ code: "resend_not_configured", message: "Az e-mail-szolgáltató nincs konfigurálva.", retryable: true });
      const { data: sent, error: sendError } = await sendIdempotentEmail({
        from: getEmailFromAddress(),
        to: message.recipient,
        replyTo: message.replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }, delivery.deliveryKey);
      if (sendError) throw new ApplicationEmailFailure(resendFailure(sendError));
      return { messageId: sent?.id ?? null };
    },
    markSent: (delivery, messageId) => completeDelivery(delivery, "sent", { messageId }),
    scheduleRetry: (delivery, retryFailure, nextAttemptAt) => completeDelivery(delivery, "queued", { failure: retryFailure, nextAttemptAt }),
    markFailed: (delivery, finalFailure) => completeDelivery(delivery, "failed", { failure: finalFailure }),
  });
}

export async function queueAndProcessApplicationEmails(applicationId: string, companyId: string, applicantEmail: string) {
  await enqueueApplicationEmails(applicationId, companyId, applicantEmail);
  return processDueApplicationEmails({ applicationId, limit: 3 });
}
