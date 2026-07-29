import assert from "node:assert/strict";
import test from "node:test";
import {
  deliverApplicationNotificationMessages,
  planApplicationNotificationMessages,
  type ApplicationNotificationInput,
} from "../src/lib/email/application-notification-plan.ts";

const application: ApplicationNotificationInput = {
  id: "11111111-1111-4111-8111-111111111111",
  applicant_name: "Teszt Jelentkező <script>",
  applicant_email: "applicant@example.test",
  applicant_phone: "+36 30 123 4567",
  created_at: "2026-07-29T10:00:00.000Z",
  job: { company_id: "22222222-2222-4222-8222-222222222222", title: "Raktáros", location: "Budapest" },
  company: { name: "Teszt Cég", contact_email: "partner@example.test" },
  answers: [
    { question_label_snapshot: "Van tapasztalata?", answer_text: null, answer_json: true },
    { question_label_snapshot: "Műszakok", answer_text: null, answer_json: ["Nappal", "Éjszaka"] },
    { question_label_snapshot: "Megjegyzés", answer_text: "<b>teszt</b>", answer_json: null },
    { question_label_snapshot: "Dokumentum", answer_text: null, answer_json: { uploaded: true } },
  ],
  files: [{ original_filename: "synthetic-cv.pdf" }],
};

function plan(overrides: Partial<ApplicationNotificationInput> = {}, adminEmail = "info@example.test") {
  return planApplicationNotificationMessages({
    application: { ...application, ...overrides },
    adminEmail,
    siteUrl: "https://preview.example.test/",
  });
}

test("a terv adatbázisból kapott címzettekből admin- és partnerértesítést készít", () => {
  const result = plan();
  assert.deepEqual(result.messages.map((message) => [message.role, message.recipient]), [
    ["admin", "info@example.test"],
    ["partner", "partner@example.test"],
  ]);
  assert.match(result.messages[0].text, /Van tapasztalata\?: Igen/);
  assert.match(result.messages[0].text, /Műszakok: Nappal, Éjszaka/);
  assert.match(result.messages[0].text, /Dokumentum: Dokumentum feltöltve/);
  assert.match(result.messages[0].text, /synthetic-cv\.pdf/);
  assert.match(result.messages[0].text, /Budapest/);
  assert.match(result.messages[0].text, /admin\/jelentkezok\/11111111/);
  assert.match(result.messages[1].text, /https:\/\/preview\.example\.test\/partner/);
  assert.equal(result.messages[0].replyTo, "applicant@example.test");
  assert.doesNotMatch(result.messages[0].text, /https?:\/\/[^\s]*storage/i);
  assert.doesNotMatch(result.messages[0].html, /<script>/i);
  assert.match(result.messages[0].html, /&lt;script&gt;/);
});

test("hiányzó partnercímnél csak adminüzenet készül, azonos címnél nincs duplikáció", () => {
  const missing = plan({ company: { name: "Teszt Cég", contact_email: "érvénytelen" } });
  assert.equal(missing.partnerNotificationSkipped, true);
  assert.deepEqual(missing.messages.map((message) => message.role), ["admin"]);
  const duplicate = plan({ company: { name: "Teszt Cég", contact_email: " INFO@example.test " } });
  assert.deepEqual(duplicate.messages.map((message) => message.role), ["admin"]);
});

test("a kézbesítés idempotens: meglévő delivery-keyhez nem hív Resendet", async () => {
  const sent: string[] = [];
  const results = await deliverApplicationNotificationMessages(plan().messages, {
    insertLog: async (message) => message.role === "admin" ? null : { id: "partner-log" },
    send: async (message) => { sent.push(message.role); return { messageId: "message-id" }; },
    markSent: async () => {},
    markFailed: async () => {},
  });
  assert.deepEqual(sent, ["partner"]);
  assert.deepEqual(results.map((result) => result.status), ["skipped", "sent"]);
});

test("egyik címzett Resend-hibája nem akadályozza a másik címzettet, és a státusz naplózható", async () => {
  const sent: string[] = [];
  const failures: string[] = [];
  const succeeded: string[] = [];
  const results = await deliverApplicationNotificationMessages(plan().messages, {
    insertLog: async (message) => ({ id: `${message.role}-log` }),
    send: async (message) => {
      sent.push(message.role);
      if (message.role === "admin") throw new Error("provider unavailable");
      return { messageId: "partner-message" };
    },
    markSent: async (id) => { succeeded.push(id); },
    markFailed: async (id) => { failures.push(id); },
  });
  assert.deepEqual(sent.sort(), ["admin", "partner"]);
  assert.deepEqual(failures, ["admin-log"]);
  assert.deepEqual(succeeded, ["partner-log"]);
  assert.deepEqual(results.map((result) => result.status).sort(), ["failed", "sent"]);
});
