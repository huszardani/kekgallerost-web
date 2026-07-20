import "server-only";

import { env } from "@/lib/env";
import { createResendClient, getEmailFromAddress } from "@/lib/email/resend";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export type ApplicationConfirmationInput = { id: string };
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character); }
function htmlText(value: string) { return escapeHtml(value).replace(/\n/g, "<br />"); }
function answerValue(answer: { answer_text: string | null; answer_json: unknown }) { if (answer.answer_text) return answer.answer_text; if (Array.isArray(answer.answer_json)) return answer.answer_json.join(", "); if (typeof answer.answer_json === "boolean") return answer.answer_json ? "Igen" : "Nem"; return answer.answer_json ? JSON.stringify(answer.answer_json) : "—"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("hu-HU", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Budapest" }).format(new Date(value)); }

export async function sendApplicationConfirmationEmail(input: ApplicationConfirmationInput) {
  if (!env.resendApiKey) return { status: "skipped" as const, reason: "RESEND_API_KEY is not configured" };
  const supabase = createServiceSupabaseClient();
  const { data: application, error: applicationError } = await supabase.from("applications").select("id, job_id, applicant_name, applicant_email, applicant_phone, created_at").eq("id", input.id).single();
  if (applicationError || !application) return { status: "failed" as const };
  const [{ data: job }, { data: answers }, { data: files }, { data: template }] = await Promise.all([
    supabase.from("jobs").select("id, company_id, title, work_schedule, important_information").eq("id", application.job_id).single(),
    supabase.from("application_answers").select("question_label_snapshot, answer_text, answer_json").eq("application_id", application.id).order("created_at"),
    supabase.from("uploaded_files").select("id").eq("application_id", application.id).limit(1),
    supabase.from("email_templates").select("*").eq("id", "application_confirmation").single()
  ]);
  if (!job) return { status: "failed" as const };
  const { data: company } = await supabase.from("companies").select("name, contact_email, contact_phone").eq("id", job.company_id).single();
  const copy = template ?? { subject: "Jelentkezésed megérkezett – {{job_title}}", intro_text: "Köszönjük, hogy jelentkeztél. Az alábbiakban összefoglaljuk a beküldött adataidat.", next_step_text: "Munkatársunk hamarosan átnézi a jelentkezésedet, és jelentkezik a megadott elérhetőségeid egyikén.", contact_details: "Kérdés esetén írj az info@kekgallerost.hu címre.", signature: "Üdvözlettel,\nA Kékgalléros csapata" };
  const subject = copy.subject.replaceAll("{{job_title}}", job.title).slice(0, 250);
  const deliveryKey = `application_confirmation:${application.id}`;
  const { data: log, error: logError } = await supabase.from("email_logs").insert({ application_id: application.id, company_id: job.company_id, provider: "resend", from_email: getEmailFromAddress(), to_email: application.applicant_email, subject, template_key: "application_confirmation", delivery_key: deliveryKey, status: "queued" }).select("id").single();
  if (logError) return { status: logError.code === "23505" ? "duplicate" as const : "failed" as const };

  const submittedAt = formatDate(application.created_at);
  const answerLines = (answers ?? []).map((answer) => `${answer.question_label_snapshot}: ${answerValue(answer)}`);
  const important = [job.work_schedule, job.important_information].filter(Boolean).slice(0, 2) as string[];
  const contact = [company?.contact_email, company?.contact_phone].filter(Boolean).join(" · ") || copy.contact_details;
  const text = [
    `Kedves ${application.applicant_name}!`, "", copy.intro_text, "",
    `Állás: ${job.title}`, `Cég: ${company?.name ?? "Kékgalléros partner"}`, `Jelentkezés időpontja: ${submittedAt}`,
    `Név: ${application.applicant_name}`, `E-mail: ${application.applicant_email}`, `Telefonszám: ${application.applicant_phone ?? "nem adott meg"}`,
    ...(answerLines.length ? ["", "Megadott válaszok:", ...answerLines] : []),
    `Önéletrajz: ${(files ?? []).length ? "sikeresen feltöltve" : "nem került feltöltésre"}`,
    ...(important.length ? ["", "Fontos tudnivalók:", ...important.map((item) => `- ${item}`)] : []),
    "", copy.next_step_text, "", `Kapcsolat: ${contact}`, "", copy.signature,
    "", "Adatvédelmi tájékoztató: a jelentkezésed adatait kizárólag a kiválasztási folyamat céljából kezeljük."
  ].join("\n");
  const answerHtml = answerLines.length ? `<h2 style="font-size:18px">Megadott válaszok</h2><dl>${(answers ?? []).map((answer) => `<dt style="font-weight:700;margin-top:10px">${escapeHtml(answer.question_label_snapshot)}</dt><dd style="margin:3px 0 0">${htmlText(answerValue(answer))}</dd>`).join("")}</dl>` : "";
  const importantHtml = important.length ? `<h2 style="font-size:18px">Fontos tudnivalók</h2><ul>${important.map((item) => `<li>${htmlText(item)}</li>`).join("")}</ul>` : "";
  const html = `<div style="background:#f4f7fb;padding:28px;font-family:Arial,sans-serif;color:#172033"><div style="max-width:680px;margin:auto;background:#fff;border:1px solid #dfe5ed;border-radius:12px;padding:30px"><div style="color:#145da0;font-size:13px;font-weight:700">KÉKGALLÉROS</div><h1 style="font-size:25px">Kedves ${escapeHtml(application.applicant_name)}!</h1><p>${htmlText(copy.intro_text)}</p><div style="background:#f7f9fc;border-radius:8px;padding:18px;margin:20px 0"><strong>${escapeHtml(job.title)}</strong><br />${escapeHtml(company?.name ?? "Kékgalléros partner")}<br /><span style="color:#667085">${escapeHtml(submittedAt)}</span></div><h2 style="font-size:18px">Megadott adatok</h2><p>Név: ${escapeHtml(application.applicant_name)}<br />E-mail: ${escapeHtml(application.applicant_email)}<br />Telefonszám: ${escapeHtml(application.applicant_phone ?? "nem adott meg")}<br />Önéletrajz: ${(files ?? []).length ? "sikeresen feltöltve" : "nem került feltöltésre"}</p>${answerHtml}${importantHtml}<h2 style="font-size:18px">Mi történik ezután?</h2><p>${htmlText(copy.next_step_text)}</p><p>${htmlText(contact)}</p><p>${htmlText(copy.signature)}</p><hr style="border:0;border-top:1px solid #e5e9ef;margin:24px 0" /><p style="color:#667085;font-size:12px">A jelentkezésed adatait kizárólag a kiválasztási folyamat céljából kezeljük. Belső CRM-adatot és feltöltött dokumentumot ez az e-mail nem tartalmaz.</p></div></div>`;
  try {
    const { data, error } = await createResendClient().emails.send({ from: getEmailFromAddress(), to: application.applicant_email, subject, text, html });
    if (error) throw error;
    await supabase.from("email_logs").update({ status: "sent", provider_message_id: data?.id ?? null, sent_at: new Date().toISOString() }).eq("id", log.id);
    return { status: "sent" as const, id: data?.id ?? null };
  } catch (error) {
    console.error("Application confirmation email failed", error instanceof Error ? error.message : "unknown error");
    await supabase.from("email_logs").update({ status: "failed", error_message: error instanceof Error ? error.message.slice(0, 1000) : "Unknown email error" }).eq("id", log.id);
    return { status: "failed" as const };
  }
}
