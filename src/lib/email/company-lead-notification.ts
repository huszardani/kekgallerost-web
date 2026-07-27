import "server-only";

import type { CompanyLead } from "@/lib/supabase/database.types";
import { env } from "@/lib/env";
import { createResendClient, getEmailFromAddress } from "@/lib/email/resend";
import { buildCompanyLeadNotification } from "@/lib/email/company-lead-notification-content";

export async function sendCompanyLeadNotification(lead: CompanyLead) {
  if (!env.companyLeadNotificationEmail) {
    throw new Error("Missing COMPANY_LEAD_NOTIFICATION_EMAIL environment variable.");
  }

  const content = buildCompanyLeadNotification(lead);
  const { data, error } = await createResendClient().emails.send({
    from: getEmailFromAddress(),
    to: env.companyLeadNotificationEmail,
    replyTo: lead.email,
    subject: content.subject,
    text: content.text,
    html: content.html
  });

  if (error) throw new Error("Resend rejected the company lead notification.");
  return { id: data?.id ?? null };
}