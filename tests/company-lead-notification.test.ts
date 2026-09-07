import assert from "node:assert/strict";
import test from "node:test";
import { persistCompanyLeadAndNotify } from "../src/lib/company-lead-notification-flow.ts";
import { buildCompanyLeadNotification } from "../src/lib/email/company-lead-notification-content.ts";
import type { CompanyLead } from "../src/lib/supabase/database.types.ts";

const lead: CompanyLead = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  created_at: "2026-07-27T08:30:00.000Z",
  status: "new",
  source: "company_interest_form",
  request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  company: "Teszt <script>alert(1)</script> & Kft.\nMásodik sor",
  contact_name: "Teszt & Elek",
  email: "teszt@example.com",
  phone: "+36 30 000 0000",
  call_time: "Délelőtt",
  role: "Operátor",
  headcount: 2,
  location: "Tesztváros",
  start_urgency: "1 héten belül",
  shifts: ["1 műszak", "2 műszak"],
  has_salary: "Igen, meg tudjuk adni",
  salary: "Bruttó 500 000 Ft",
  requirements: ["Tapasztalat szükséges"],
  must_know: "Állómunka <font>",
  main_problems: ["Kevés a jelentkező"],
  advertised_before: "Nem, ez az első kampány",
  package: "Nem tudom, kérek javaslatot",
  notes: "Megjegyzés > próba",
  notification_status: "pending",
  notification_attempted_at: null,
  notification_sent_at: null,
  notification_provider_message_id: null
};

const fixedTime = "2026-07-27T09:00:00.000Z";

test("a céges lead e-mail minden mezőt tartalmaz, és HTML-ben escape-el", () => {
  const content = buildCompanyLeadNotification(lead);

  assert.equal(content.subject, "Új céges érdeklődő – Teszt <script>alert(1)</script> & Kft. Második sor");
  assert.match(content.text, /Cégnév: Teszt <script>alert\(1\)<\/script> & Kft\./);
  assert.match(content.text, /Lead azonosító: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/);
  assert.match(content.text, /Beküldés időpontja:/);
  assert.match(content.text, /Műszakrend: 1 műszak, 2 műszak/);
  assert.doesNotMatch(content.html, /<script>/);
  assert.match(content.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; Kft\./);
  assert.match(content.html, /Állómunka &lt;font&gt;/);
  assert.match(content.html, /Megjegyzés &gt; próba/);
});

test("sikeres új mentés után egyszer küld, sent állapotot és időpontot rögzít, a duplikátum nem küld újra", async () => {
  let firstInsert = true;
  let sendCalls = 0;
  const updates: Array<{ leadId: string; update: Record<string, unknown> }> = [];
  const dependencies = {
    insertLead: async () => {
      if (!firstInsert) return null;
      firstInsert = false;
      return lead;
    },
    findLead: async () => ({ id: lead.id, notification_status: "sent" as const }),
    sendNotification: async (sentLead: CompanyLead) => {
      assert.equal(sentLead.id, lead.id);
      sendCalls += 1;
      return { id: "resend-message-id" };
    },
    updateNotification: async (leadId: string, update: Record<string, unknown>) => {
      updates.push({ leadId, update });
    },
    now: () => fixedTime
  };

  const first = await persistCompanyLeadAndNotify(dependencies);
  const duplicate = await persistCompanyLeadAndNotify(dependencies);

  assert.equal(first.created, true);
  assert.equal(first.notificationStatus, "sent");
  assert.equal(duplicate.created, false);
  assert.equal(sendCalls, 1);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0], {
    leadId: lead.id,
    update: {
      notification_status: "sent",
      notification_attempted_at: fixedTime,
      notification_sent_at: fixedTime,
      notification_provider_message_id: "resend-message-id"
    }
  });
});

test("Resend-hibánál a mentett lead sikeres marad, és failed állapot rögzül", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const result = await persistCompanyLeadAndNotify({
    insertLead: async () => lead,
    findLead: async () => null,
    sendNotification: async () => {
      throw new Error("szimulált Resend-hiba");
    },
    updateNotification: async (_leadId, update) => {
      updates.push(update);
    },
    now: () => fixedTime
  });

  assert.equal(result.leadId, lead.id);
  assert.equal(result.created, true);
  assert.equal(result.notificationStatus, "failed");
  assert.equal(result.notificationStateUpdateFailed, false);
  assert.deepEqual(updates, [{
    notification_status: "failed",
    notification_attempted_at: fixedTime,
    notification_sent_at: null,
    notification_provider_message_id: null
  }]);
});