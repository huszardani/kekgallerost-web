import type { CompanyLead } from "./supabase/database.types";

type NotificationUpdate = {
  notification_status: "sent" | "failed";
  notification_attempted_at: string;
  notification_sent_at: string | null;
  notification_provider_message_id: string | null;
};

export type CompanyLeadNotificationFlowDependencies = {
  insertLead: () => Promise<CompanyLead | null>;
  findLead: () => Promise<Pick<CompanyLead, "id" | "notification_status"> | null>;
  sendNotification: (lead: CompanyLead) => Promise<{ id: string | null }>;
  updateNotification: (leadId: string, update: NotificationUpdate) => Promise<void>;
  now?: () => string;
};

export async function persistCompanyLeadAndNotify(dependencies: CompanyLeadNotificationFlowDependencies) {
  const inserted = await dependencies.insertLead();
  if (!inserted) {
    const existing = await dependencies.findLead();
    if (!existing) throw new Error("Persisted company lead could not be verified.");
    return {
      leadId: existing.id,
      created: false,
      notificationStatus: existing.notification_status,
      notificationStateUpdateFailed: false
    };
  }

  const attemptedAt = (dependencies.now ?? (() => new Date().toISOString()))();
  try {
    const sent = await dependencies.sendNotification(inserted);
    let notificationStateUpdateFailed = false;
    try {
      await dependencies.updateNotification(inserted.id, {
        notification_status: "sent",
        notification_attempted_at: attemptedAt,
        notification_sent_at: attemptedAt,
        notification_provider_message_id: sent.id
      });
    } catch {
      notificationStateUpdateFailed = true;
    }
    return {
      leadId: inserted.id,
      created: true,
      notificationStatus: "sent" as const,
      notificationStateUpdateFailed
    };
  } catch {
    let notificationStateUpdateFailed = false;
    try {
      await dependencies.updateNotification(inserted.id, {
        notification_status: "failed",
        notification_attempted_at: attemptedAt,
        notification_sent_at: null,
        notification_provider_message_id: null
      });
    } catch {
      notificationStateUpdateFailed = true;
    }
    return {
      leadId: inserted.id,
      created: true,
      notificationStatus: "failed" as const,
      notificationStateUpdateFailed
    };
  }
}