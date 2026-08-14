import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ApplicationEmailFailure,
  MAX_APPLICATION_EMAIL_ATTEMPTS,
  processClaimedApplicationEmail,
  processClaimedApplicationEmails,
  processDueApplicationEmailBatch,
  type ApplicationEmailDeliveryDependencies,
  type ClaimedApplicationEmail,
  type PreparedApplicationEmail,
} from "../src/lib/email/application-email-delivery.ts";
import { runPostPersistenceEmailWorkflow } from "../src/lib/email/application-email-workflow.ts";
import { applicationEmailAdminStatuses } from "../src/lib/email/application-email-admin-status.ts";

const message: PreparedApplicationEmail = {
  recipient: "synthetic@example.test",
  subject: "TESZT jelentkezés",
  text: "Teszt",
  html: "<p>Teszt</p>",
  replyTo: "applicant@example.test",
};

function claimed(role: "applicant" | "admin" | "partner", attemptCount = 1): ClaimedApplicationEmail {
  return {
    id: `${role}-log`,
    applicationId: "11111111-1111-4111-8111-111111111111",
    role,
    deliveryKey: `application_email:${role}:11111111-1111-4111-8111-111111111111`,
    attemptCount,
    workerId: "22222222-2222-4222-8222-222222222222",
  };
}

function dependencies(overrides: Partial<ApplicationEmailDeliveryDependencies> = {}) {
  return {
    prepare: async () => message,
    send: async () => ({ messageId: "resend-test-id" }),
    markSent: async () => {},
    scheduleRetry: async () => {},
    markFailed: async () => {},
    ...overrides,
  } satisfies ApplicationEmailDeliveryDependencies;
}

test("a sikeresen mentett jelentkezés e-mailhibánál is sikeres munkafolyamat-választ kap", async () => {
  const persistedApplications = 1;
  const result = await runPostPersistenceEmailWorkflow(async () => {
    throw new Error("Resend unavailable");
  });
  assert.deepEqual(result, { emailStatus: "pending" });
  assert.equal(persistedApplications, 1);
});

test("átmeneti hiba után ugyanaz a logikai küldés sikeresen újrapróbálható", async () => {
  const scheduled: string[] = [];
  let sendAttempts = 0;
  const transient = dependencies({
    send: async () => {
      sendAttempts += 1;
      throw new ApplicationEmailFailure({ code: "provider_temporarily_unavailable", message: "Átmeneti szolgáltatói hiba.", retryable: true });
    },
    scheduleRetry: async (_delivery, _failure, nextAttemptAt) => { scheduled.push(nextAttemptAt); },
  });
  const first = await processClaimedApplicationEmail(claimed("admin", 1), transient, new Date("2026-08-11T10:00:00.000Z"));
  assert.equal(first.status, "pending");
  assert.equal(scheduled[0], "2026-08-11T10:05:00.000Z");

  let markedSent = 0;
  const second = await processClaimedApplicationEmail(claimed("admin", 2), dependencies({
    send: async () => { sendAttempts += 1; return { messageId: "sent" }; },
    markSent: async () => { markedSent += 1; },
  }));
  assert.equal(second.status, "sent");
  assert.equal(markedSent, 1);
  assert.equal(sendAttempts, 2);
  assert.equal(claimed("admin", 1).deliveryKey, claimed("admin", 2).deliveryKey);
});

test("sikeres Resend-küldés utáni adatbázishibánál a retry ugyanazt az idempotenciakulcsot használja", async () => {
  const providerDeliveries = new Map<string, string>();
  const keys: string[] = [];
  let markAttempts = 0;
  const deps = dependencies({
    send: async (delivery) => {
      keys.push(delivery.deliveryKey);
      const messageId = providerDeliveries.get(delivery.deliveryKey) ?? "resend-once";
      providerDeliveries.set(delivery.deliveryKey, messageId);
      return { messageId };
    },
    markSent: async () => {
      markAttempts += 1;
      if (markAttempts === 1) throw new Error("database unavailable after provider success");
    },
  });
  const first = await processClaimedApplicationEmail(claimed("applicant", 1), deps, new Date("2026-08-11T10:00:00.000Z"));
  const second = await processClaimedApplicationEmail(claimed("applicant", 2), deps);
  assert.equal(first.status, "pending");
  assert.equal(second.status, "sent");
  assert.deepEqual(keys, [claimed("applicant").deliveryKey, claimed("applicant").deliveryKey]);
  assert.equal(providerDeliveries.size, 1);
});

test("a migráció kompatibilis a részleges unique indexszel, helyreállítja a queue-t és nem aktivál cront", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608110001_application_email_delivery_retries.sql", import.meta.url), "utf8");
  const cronDefinition = sql.indexOf("create or replace function public.configure_application_email_retry_cron()");
  assert.notEqual(cronDefinition, -1);
  assert.match(sql, /on conflict \(delivery_key\) where delivery_key is not null do nothing/);
  assert.match(sql, /applications\.email_delivery_requested_at is not null/);
  assert.doesNotMatch(sql.slice(0, cronDefinition), /configure_application_email_retry_cron\s*\(\s*\)\s*;/);
});

test("a Resend-kérés a tartós delivery keyt szolgáltatói idempotenciakulcsként küldi", async () => {
  const source = await readFile(new URL("../src/lib/email/resend.ts", import.meta.url), "utf8");
  assert.match(source, /"Idempotency-Key": idempotencyKey/);
});

test("legfeljebb három automatikus kísérlet után végleges failed állapot keletkezik", async () => {
  const pending: number[] = [];
  const failed: number[] = [];
  for (let attempt = 1; attempt <= MAX_APPLICATION_EMAIL_ATTEMPTS; attempt += 1) {
    const result = await processClaimedApplicationEmail(claimed("partner", attempt), dependencies({
      send: async () => { throw new ApplicationEmailFailure({ code: "temporary", message: "Átmeneti hiba.", retryable: true }); },
      scheduleRetry: async (delivery) => { pending.push(delivery.attemptCount); },
      markFailed: async (delivery) => { failed.push(delivery.attemptCount); },
    }), new Date("2026-08-11T10:00:00.000Z"));
    assert.equal(result.status, attempt < MAX_APPLICATION_EMAIL_ATTEMPTS ? "pending" : "failed");
  }
  assert.deepEqual(pending, [1, 2]);
  assert.deepEqual(failed, [3]);
});

test("sikeresen elküldött levél nem claimelhető újra, párhuzamos feldolgozók sem dupláznak", async () => {
  let available = true;
  let sends = 0;
  const claim = async () => {
    if (!available) return [];
    available = false;
    return [claimed("applicant")];
  };
  const deps = dependencies({ send: async () => { sends += 1; return { messageId: "sent" }; } });
  const results = await Promise.all([
    processDueApplicationEmailBatch(claim, deps),
    processDueApplicationEmailBatch(claim, deps),
  ]);
  assert.equal(sends, 1);
  assert.deepEqual(results.map((items) => items.length).sort(), [0, 1]);
});

test("az admin- és partnerhiba egymástól, valamint a jelentkezői levéltől független", async () => {
  for (const failingRole of ["admin", "partner"] as const) {
    const attempted: string[] = [];
    const results = await processClaimedApplicationEmails([
      claimed("applicant"), claimed("partner"), claimed("admin"),
    ], dependencies({
      prepare: async (delivery) => ({ ...message, recipient: `${delivery.role}@example.test` }),
      send: async (_delivery, prepared) => {
        attempted.push(prepared.recipient);
        if (prepared.recipient.startsWith(failingRole)) {
          throw new ApplicationEmailFailure({ code: "invalid_recipient", message: "Hibás címzett.", retryable: false });
        }
        return { messageId: "sent" };
      },
    }));
    assert.equal(attempted.length, 3);
    assert.deepEqual(results.map((item) => item.status), failingRole === "partner"
      ? ["sent", "failed", "sent"]
      : ["sent", "sent", "failed"]);
  }
});
test("adatlekérési hiba, hiányzó partnercím vagy hiányzó válasz esetén nincs Resend-hívás", async () => {
  const failures = [
    new ApplicationEmailFailure({ code: "related_data_lookup_failed", message: "Lekérési hiba.", retryable: true }),
    new ApplicationEmailFailure({ code: "recipient_missing_or_invalid", message: "Hiányzó partnercím.", retryable: false }),
    new ApplicationEmailFailure({ code: "application_answers_missing", message: "Hiányzó válaszok.", retryable: false }),
  ];
  for (const preparationFailure of failures) {
    let sends = 0;
    let retries = 0;
    let finalFailures = 0;
    const result = await processClaimedApplicationEmail(claimed("partner"), dependencies({
      prepare: async () => { throw preparationFailure; },
      send: async () => { sends += 1; return { messageId: null }; },
      scheduleRetry: async () => { retries += 1; },
      markFailed: async () => { finalFailures += 1; },
    }));
    assert.equal(sends, 0);
    assert.equal(result.status, preparationFailure.failure.retryable ? "pending" : "failed");
    assert.equal(retries, preparationFailure.failure.retryable ? 1 : 0);
    assert.equal(finalFailures, preparationFailure.failure.retryable ? 0 : 1);
  }
});
test("az adminnézet mindhárom címzetti szerep állapotát és próbálkozását képezi", () => {
  const rows = applicationEmailAdminStatuses([
    { id: "a", to_email: "applicant@example.test", template_key: "application_confirmation", recipient_role: "applicant", status: "sent", attempt_count: 1, last_attempt_at: "2026-08-11T10:00:00Z", next_attempt_at: null, error_code: null, error_message: null, sent_at: "2026-08-11T10:00:01Z" },
    { id: "p", to_email: "partner@example.test", template_key: "application_notification_partner", recipient_role: "partner", status: "queued", attempt_count: 2, last_attempt_at: "2026-08-11T10:00:00Z", next_attempt_at: "2026-08-11T10:30:00Z", error_code: "provider_temporarily_unavailable", error_message: "Átmeneti hiba.", sent_at: null },
    { id: "m", to_email: "admin@example.test", template_key: "application_notification_admin", recipient_role: "admin", status: "failed", attempt_count: 3, last_attempt_at: "2026-08-11T10:00:00Z", next_attempt_at: null, error_code: "recipient_missing_or_invalid", error_message: "provider raw detail must stay hidden", sent_at: null },
  ]);
  assert.deepEqual(rows.map((row) => [row.role, row.status, row.email?.attempt_count]), [
    ["applicant", "elküldve", 1], ["partner", "függőben", 2], ["admin", "sikertelen", 3],
  ]);
  assert.equal(rows[2].safeError, "A címzett hiányzik vagy érvénytelen.");
  assert.doesNotMatch(rows[2].safeError ?? "", /provider raw detail/);
});
