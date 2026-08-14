export const MAX_APPLICATION_EMAIL_ATTEMPTS = 3;
export const APPLICATION_EMAIL_RETRY_DELAYS_MS = [5 * 60_000, 30 * 60_000] as const;

export type ApplicationEmailRole = "applicant" | "admin" | "partner";

export type ClaimedApplicationEmail = {
  id: string;
  applicationId: string;
  role: ApplicationEmailRole;
  deliveryKey: string;
  attemptCount: number;
  workerId: string;
};

export type PreparedApplicationEmail = {
  recipient: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

export type SafeDeliveryFailure = {
  code: string;
  message: string;
  retryable: boolean;
};

export class ApplicationEmailFailure extends Error {
  readonly failure: SafeDeliveryFailure;

  constructor(failure: SafeDeliveryFailure) {
    super(failure.message);
    this.failure = failure;
  }
}

export type ApplicationEmailDeliveryDependencies = {
  prepare: (delivery: ClaimedApplicationEmail) => Promise<PreparedApplicationEmail>;
  send: (delivery: ClaimedApplicationEmail, message: PreparedApplicationEmail) => Promise<{ messageId: string | null }>;
  markSent: (delivery: ClaimedApplicationEmail, messageId: string | null) => Promise<void>;
  scheduleRetry: (delivery: ClaimedApplicationEmail, failure: SafeDeliveryFailure, nextAttemptAt: string) => Promise<void>;
  markFailed: (delivery: ClaimedApplicationEmail, failure: SafeDeliveryFailure) => Promise<void>;
};

function safeFailure(error: unknown): SafeDeliveryFailure {
  if (error instanceof ApplicationEmailFailure) return error.failure;
  return {
    code: "provider_temporarily_unavailable",
    message: "Az e-mail-szolgáltató átmenetileg nem elérhető.",
    retryable: true,
  };
}

export function retryAtForAttempt(attemptCount: number, now: Date) {
  const delay = APPLICATION_EMAIL_RETRY_DELAYS_MS[attemptCount - 1];
  return delay === undefined ? null : new Date(now.getTime() + delay).toISOString();
}

export async function processClaimedApplicationEmail(
  delivery: ClaimedApplicationEmail,
  dependencies: ApplicationEmailDeliveryDependencies,
  now = new Date(),
) {
  try {
    const message = await dependencies.prepare(delivery);
    const result = await dependencies.send(delivery, message);
    await dependencies.markSent(delivery, result.messageId);
    return { status: "sent" as const, role: delivery.role };
  } catch (error) {
    const failure = safeFailure(error);
    const nextAttemptAt = failure.retryable && delivery.attemptCount < MAX_APPLICATION_EMAIL_ATTEMPTS
      ? retryAtForAttempt(delivery.attemptCount, now)
      : null;
    if (nextAttemptAt) {
      await dependencies.scheduleRetry(delivery, failure, nextAttemptAt);
      return { status: "pending" as const, role: delivery.role, nextAttemptAt };
    }
    await dependencies.markFailed(delivery, failure);
    return { status: "failed" as const, role: delivery.role };
  }
}

export async function processClaimedApplicationEmails(
  deliveries: ClaimedApplicationEmail[],
  dependencies: ApplicationEmailDeliveryDependencies,
  now = new Date(),
) {
  return Promise.all(deliveries.map((delivery) => processClaimedApplicationEmail(delivery, dependencies, now)));
}
export async function processDueApplicationEmailBatch(
  claim: () => Promise<ClaimedApplicationEmail[]>,
  dependencies: ApplicationEmailDeliveryDependencies,
  now = new Date(),
) {
  const deliveries = await claim();
  return processClaimedApplicationEmails(deliveries, dependencies, now);
}
