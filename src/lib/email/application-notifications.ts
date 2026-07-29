import { env } from "@/lib/env";
import {
  deliverApplicationNotificationMessages,
  planApplicationNotificationMessages,
  type ApplicationNotificationInput,
} from "@/lib/email/application-notification-plan";
import { createResendClient, getEmailFromAddress } from "@/lib/email/resend";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function sendApplicationNotificationEmails(applicationId: string) {
  const supabase = createServiceSupabaseClient();
  const { data: application } = await supabase
    .from("applications")
    .select("id, applicant_name, applicant_email, applicant_phone, created_at, job_id")
    .eq("id", applicationId)
    .single();
  if (!application) return { status: "failed" as const };

  const [{ data: job }, { data: answers }, { data: files }] = await Promise.all([
    supabase.from("jobs").select("company_id, title, location").eq("id", application.job_id).single(),
    supabase.from("application_answers").select("question_label_snapshot, answer_text, answer_json").eq("application_id", application.id).order("created_at"),
    supabase.from("uploaded_files").select("original_filename").eq("application_id", application.id),
  ]);
  if (!job) return { status: "failed" as const };
  const { data: company } = await supabase.from("companies").select("name, contact_email").eq("id", job.company_id).single();

  const input: ApplicationNotificationInput = {
    ...application,
    job,
    company,
    answers: answers ?? [],
    files: files ?? [],
  };
  const plan = planApplicationNotificationMessages({
    application: input,
    adminEmail: env.applicationNotificationAdminEmail,
    siteUrl: env.siteUrl,
  });

  if (plan.partnerNotificationSkipped) {
    try {
      await supabase.from("activity_logs").insert({
        entity_type: "application",
        entity_id: application.id,
        action: "partner_notification_skipped",
        new_value: "missing_or_invalid_company_contact_email",
        actor_id: null,
      });
    } catch {
      // A naplózási hiba nem akadályozhatja az adminértesítést.
    }
  }
  if (!env.resendApiKey || plan.messages.length === 0) return { status: "skipped" as const };

  const results = await deliverApplicationNotificationMessages(plan.messages, {
    insertLog: async (message) => {
      const { data } = await supabase
        .from("email_logs")
        .insert({
          application_id: application.id,
          company_id: job.company_id,
          provider: "resend",
          from_email: getEmailFromAddress(),
          to_email: message.recipient,
          subject: message.subject,
          template_key: `application_notification_${message.role}`,
          delivery_key: message.deliveryKey,
          status: "queued",
        })
        .select("id")
        .single();
      return data;
    },
    send: async (message) => {
      const { data, error } = await createResendClient().emails.send({
        from: getEmailFromAddress(),
        to: message.recipient,
        replyTo: message.replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      if (error) throw error;
      return { messageId: data?.id ?? null };
    },
    markSent: async (logId, messageId) => {
      await supabase.from("email_logs").update({ status: "sent", provider_message_id: messageId, sent_at: new Date().toISOString() }).eq("id", logId);
    },
    markFailed: async (logId, reason) => {
      await supabase.from("email_logs").update({ status: "failed", error_message: reason }).eq("id", logId);
    },
  });
  return { status: "completed" as const, results };
}