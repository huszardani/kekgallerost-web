import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateCompanyLead } from "../src/lib/company-leads.ts";

const validPayload = {
  requestId: "11111111-1111-4111-8111-111111111111",
  company: "TESZT Kft.",
  contactName: "Teszt Elek",
  email: "teszt@example.com",
  phone: "+36 30 000 0000",
  callTime: "Délelőtt",
  role: "Teszt operátor",
  headcount: "2",
  location: "Tesztváros",
  startUrgency: "1 héten belül",
  shift: ["1 műszak"],
  hasSalary: "Igen, meg tudjuk adni",
  salary: "Teszt bérsáv",
  requirements: ["Tapasztalat szükséges"],
  mustKnow: "TESZT",
  mainProblem: ["Kevés a jelentkező"],
  advertisedBefore: "Nem, ez az első kampány",
  package: "Nem tudom, kérek javaslatot",
  notes: "AUTOMATIZÁLT TESZT"
};

test("minden céges űrlapmezőt és a rögzített metaadatokat normalizálja", () => {
  const result = validateCompanyLead(validPayload);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.lead, {
    request_id: validPayload.requestId,
    company: validPayload.company,
    contact_name: validPayload.contactName,
    email: validPayload.email,
    phone: validPayload.phone,
    call_time: validPayload.callTime,
    role: validPayload.role,
    headcount: 2,
    location: validPayload.location,
    start_urgency: validPayload.startUrgency,
    shifts: validPayload.shift,
    has_salary: validPayload.hasSalary,
    salary: validPayload.salary,
    requirements: validPayload.requirements,
    must_know: validPayload.mustKnow,
    main_problems: validPayload.mainProblem,
    advertised_before: validPayload.advertisedBefore,
    package: validPayload.package,
    notes: validPayload.notes,
    status: "new",
    source: "company_interest_form"
  });
});

test("hiányzó kötelező mezőt és checkbox-csoportot elutasít", () => {
  assert.equal(validateCompanyLead({ ...validPayload, company: "" }).error, "Kérjük, töltsd ki az összes kötelező mezőt.");
  assert.equal(validateCompanyLead({ ...validPayload, shift: [] }).error, "Kérjük, töltsd ki az összes kötelező mezőt.");
  assert.equal(validateCompanyLead({ ...validPayload, mainProblem: [] }).error, "Kérjük, töltsd ki az összes kötelező mezőt.");
});

test("érvénytelen e-mailt, létszámot és idempotenciakulcsot elutasít", () => {
  assert.equal(validateCompanyLead({ ...validPayload, email: "invalid" }).error, "Kérjük, töltsd ki az összes kötelező mezőt.");
  assert.equal(validateCompanyLead({ ...validPayload, headcount: 0 }).error, "Kérjük, töltsd ki az összes kötelező mezőt.");
  assert.equal(validateCompanyLead({ ...validPayload, requestId: "not-a-uuid" }).error, "Kérjük, töltsd ki az összes kötelező mezőt.");
});

test("a kliens és API csak igazolt mentés után jelez sikert", () => {
  const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const route = readFileSync(new URL("../src/app/api/company-leads/route.ts", import.meta.url), "utf8");
  assert.ok(app.indexOf("await fetch") < app.indexOf("Köszönjük, megkaptuk a briefet."));
  assert.ok(app.indexOf("Köszönjük, megkaptuk a briefet.") < app.indexOf("form.reset()"));
  assert.match(app, /if \(isSubmitting\) return/);
  assert.match(route, /select\("id"\)/);
  assert.match(route, /return NextResponse\.json\(\{ ok: true, leadId \}/);
});