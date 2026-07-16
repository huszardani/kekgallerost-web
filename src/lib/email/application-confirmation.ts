import "server-only";

import { env } from "@/lib/env";
import { createResendClient, getEmailFromAddress } from "@/lib/email/resend";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export type ApplicationConfirmationInput = {
  id: string;
  applicantName: string;
  applicantEmail: string;
  jobTitle: string;
  companyId: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character] ?? character);
}

export async function sendApplicationConfirmationEmail(application: ApplicationConfirmationInput) {
  if (!env.resendApiKey) {
    return { status: "skipped" as const, reason: "RESEND_API_KEY is not configured" };
  }

  const supabase = createServiceSupabaseClient();
  const subject = `Jelentkezésed megérkezett – ${application.jobTitle}`;
  const { data: log } = await supabase
    .from("email_logs")
    .insert({
      application_id: application.id,
      company_id: application.companyId,
      provider: "resend",
      from_email: getEmailFromAddress(),
      to_email: application.applicantEmail,
      subject,
      template_key: "application_confirmation",
      status: "queued"
    })
    .select("id")
    .single();

  try {
    const resend = createResendClient();
    const { data, error } = await resend.emails.send({
      from: getEmailFromAddress(),
      to: application.applicantEmail,
      subject,
      text: `Kedves ${application.applicantName}! Jelentkezésed megérkezett a(z) ${application.jobTitle} állásra. Hamarosan felvesszük veled a kapcsolatot.`,
      html: `<p>Kedves ${escapeHtml(application.applicantName)}!</p><p>Jelentkezésed megérkezett a(z) <strong>${escapeHtml(application.jobTitle)}</strong> állásra.</p><p>Hamarosan felvesszük veled a kapcsolatot.</p>`
    });
    if (error) throw error;

    if (log) {
      await supabase.from("email_logs").update({
        status: "sent",
        provider_message_id: data?.id ?? null,
        sent_at: new Date().toISOString()
      }).eq("id", log.id);
    }
    return { status: "sent" as const, id: data?.id ?? null };
  } catch (error) {
    if (log) {
      await supabase.from("email_logs").update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown email error"
      }).eq("id", log.id);
    }
    return { status: "failed" as const };
  }
}

