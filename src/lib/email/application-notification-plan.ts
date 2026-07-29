export type ApplicationNotificationAnswer = {
  question_label_snapshot: string;
  answer_text: string | null;
  answer_json: unknown;
};

export type ApplicationNotificationInput = {
  id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  created_at: string;
  job: { company_id: string; title: string; location: string | null };
  company: { name: string; contact_email: string | null } | null;
  answers: ApplicationNotificationAnswer[];
  files: { original_filename: string }[];
};

export type ApplicationNotificationMessage = {
  role: "admin" | "partner";
  recipient: string;
  deliveryKey: string;
  subject: string;
  text: string;
  html: string;
  replyTo: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeNotificationEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase() ?? "";
  return emailPattern.test(normalized) ? normalized : null;
}

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });
}

function answerValue(answer: ApplicationNotificationAnswer) {
  if (answer.answer_text?.trim()) return answer.answer_text;
  if (Array.isArray(answer.answer_json)) return answer.answer_json.join(", ") || "Nincs megadva";
  if (typeof answer.answer_json === "boolean") return answer.answer_json ? "Igen" : "Nem";
  if (answer.answer_json && typeof answer.answer_json === "object") return "Dokumentum feltöltve";
  return "Nincs megadva";
}

function formatSubmittedAt(timestamp: string) {
  return new Intl.DateTimeFormat("hu-HU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Budapest",
  }).format(new Date(timestamp));
}

export function planApplicationNotificationMessages({
  application,
  adminEmail,
  siteUrl,
}: {
  application: ApplicationNotificationInput;
  adminEmail: string | null | undefined;
  siteUrl: string;
}) {
  const adminRecipient = normalizeNotificationEmail(adminEmail);
  const partnerRecipient = normalizeNotificationEmail(application.company?.contact_email);
  const subject = `Új jelentkező – ${application.job.title} – ${application.applicant_name}`
    .replace(/[\r\n]/g, " ")
    .slice(0, 250);
  const lines = [
    `Pozíció: ${application.job.title}`,
    `Cég: ${application.company?.name ?? "Nincs megadva"}`,
    `Helyszín: ${application.job.location ?? "Nincs megadva"}`,
    `Jelentkező neve: ${application.applicant_name}`,
    `Jelentkező e-mail-címe: ${application.applicant_email}`,
    `Telefonszám: ${application.applicant_phone ?? "Nincs megadva"}`,
    `Jelentkezés időpontja (Budapest): ${formatSubmittedAt(application.created_at)}`,
    `Application ID: ${application.id}`,
    "",
    ...application.answers.map((answer) => `${answer.question_label_snapshot}: ${answerValue(answer)}`),
    "",
    `Dokumentumok: ${application.files.length ? application.files.map((file) => file.original_filename).join(", ") : "Nincs feltöltve"}`,
  ];
  const normalizedSiteUrl = siteUrl.replace(/\/$/, "");
  const messages: ApplicationNotificationMessage[] = [];
  const addMessage = (role: "admin" | "partner", recipient: string, path: string) => {
    const link = `${normalizedSiteUrl}${path}`;
    messages.push({
      role,
      recipient,
      deliveryKey: `application_notification:${role}:${application.id}:${recipient}`,
      subject,
      replyTo: application.applicant_email,
      text: [...lines, "", `Megnyitás: ${link}`].join("\n"),
      html: `<div style="font-family:Arial,sans-serif"><h1>Új jelentkező</h1><p>${lines.map((line) => escapeEmailHtml(line)).join("<br />")}</p><p><a href="${escapeEmailHtml(link)}">Megnyitás</a></p></div>`,
    });
  };
  if (adminRecipient) addMessage("admin", adminRecipient, `/admin/jelentkezok/${application.id}`);
  if (partnerRecipient && partnerRecipient !== adminRecipient) addMessage("partner", partnerRecipient, "/partner");
  return {
    messages,
    partnerNotificationSkipped: !partnerRecipient,
    adminNotificationSkipped: !adminRecipient,
  };
}

export type ApplicationNotificationDeliveryDependencies = {
  insertLog: (message: ApplicationNotificationMessage) => Promise<{ id: string } | null>;
  send: (message: ApplicationNotificationMessage) => Promise<{ messageId: string | null }>;
  markSent: (logId: string, messageId: string | null) => Promise<void>;
  markFailed: (logId: string, reason: string) => Promise<void>;
};

export async function deliverApplicationNotificationMessages(
  messages: ApplicationNotificationMessage[],
  dependencies: ApplicationNotificationDeliveryDependencies,
) {
  return Promise.all(
    messages.map(async (message) => {
      const log = await dependencies.insertLog(message);
      if (!log) return { role: message.role, status: "skipped" as const };
      try {
        const delivery = await dependencies.send(message);
        await dependencies.markSent(log.id, delivery.messageId);
        return { role: message.role, status: "sent" as const };
      } catch (error) {
        const reason = error instanceof Error ? error.message.slice(0, 200) : "send_failed";
        await dependencies.markFailed(log.id, reason);
        return { role: message.role, status: "failed" as const };
      }
    }),
  );
}
