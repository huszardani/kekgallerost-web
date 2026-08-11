import type { ApplicationEmailRole } from "@/lib/email/application-email-delivery";

export type ApplicationEmailStatusRow = {
  id: string;
  template_key: string | null;
  recipient_role: ApplicationEmailRole | null;
  status: "queued" | "sent" | "failed";
  attempt_count: number;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  error_code: string | null;
  error_message: string | null;
};

const roles: ApplicationEmailRole[] = ["applicant", "partner", "admin"];

function safeErrorReason(row: ApplicationEmailStatusRow | undefined) {
  if (!row?.error_code) return row?.status === "failed" ? "A kézbesítés sikertelen." : null;
  if (row.error_code === "recipient_missing_or_invalid") return "A címzett hiányzik vagy érvénytelen.";
  if (row.error_code === "resend_not_configured") return "Az e-mail-küldés nincs konfigurálva.";
  if (row.error_code.startsWith("provider_")) return "Az e-mail-szolgáltató nem tudta kézbesíteni a levelet.";
  if (row.error_code.includes("missing") || row.error_code.includes("incomplete")) return "Az e-mailhez szükséges adatok hiányosak.";
  return "Átmeneti feldolgozási hiba.";
}
function legacyRole(row: ApplicationEmailStatusRow): ApplicationEmailRole | null {
  if (row.recipient_role) return row.recipient_role;
  if (row.template_key === "application_confirmation") return "applicant";
  if (row.template_key === "application_notification_partner") return "partner";
  if (row.template_key === "application_notification_admin") return "admin";
  return null;
}

export function applicationEmailAdminStatuses(emails: ApplicationEmailStatusRow[]) {
  return roles.map((role) => {
    const email = emails.find((item) => legacyRole(item) === role);
    return {
      role,
      email,
      label: role === "applicant" ? "Jelentkezői visszaigazolás" : role === "partner" ? "Partnerértesítés" : "Adminértesítés",
      status: email?.status === "sent" ? "elküldve" as const : email?.status === "failed" ? "sikertelen" as const : "függőben" as const,
      safeError: safeErrorReason(email),
    };
  });
}
