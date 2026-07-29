import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { TURNSTILE_FAILURE_MESSAGE, verifyTurnstile } from "../src/lib/turnstile.ts";

const validFetch: typeof fetch = async () => new Response(JSON.stringify({ success: true, action: "job_application", hostname: "kekgallerost.hu" }));
const verify = (overrides: Partial<Parameters<typeof verifyTurnstile>[0]> = {}) => verifyTurnstile({
  token: "test-token", expectedAction: "job_application", secret: "test-secret", environment: "production", fetchImpl: validFetch, ...overrides,
});

test("a Turnstile csak érvényes, megfelelő actionnel és production hostnévvel rendelkező tokent fogad el", async () => {
  assert.equal((await verify()).ok, true);
  assert.equal((await verify({ token: "" })).ok, false);
  assert.equal((await verify({ fetchImpl: async () => new Response(JSON.stringify({ success: false })) })).message, TURNSTILE_FAILURE_MESSAGE);
  assert.equal((await verify({ fetchImpl: async () => new Response(JSON.stringify({ success: true, action: "company_interest", hostname: "kekgallerost.hu" })) })).ok, false);
  assert.equal((await verify({ fetchImpl: async () => new Response(JSON.stringify({ success: true, action: "job_application", hostname: "example.test" })) })).ok, false);
});

test("a lejárt, ismételt vagy hálózati hibás token biztonságosan elutasított", async () => {
  assert.equal((await verify({ fetchImpl: async () => new Response(JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] })) })).ok, false);
  assert.equal((await verify({ fetchImpl: async () => { throw new Error("network"); } })).ok, false);
});

test("a két POST route minden adatbázis-, feltöltési és e-mail művelet előtt ellenőrzi a saját Turnstile actionjét", () => {
  const application = readFileSync(new URL("../src/app/api/applications/route.ts", import.meta.url), "utf8");
  const company = readFileSync(new URL("../src/app/api/company-leads/route.ts", import.meta.url), "utf8");
  assert.match(application, /expectedAction: "job_application"/);
  assert.match(company, /expectedAction: "company_interest"/);
  assert.ok(application.indexOf("const turnstile = await verifyTurnstile") < application.indexOf('const supabase = createServiceSupabaseClient'));
  assert.ok(company.indexOf("const turnstile = await verifyTurnstile") < company.indexOf('const supabase = createServiceSupabaseClient'));
  assert.match(application, /turnstile_token/);
  assert.match(company, /turnstileToken/);
});

test("a kliensoldali hibakezelés megőrzi az adatokat, új tokent kér, és csak siker után ürít", () => {
  const applicationForm = readFileSync(new URL("../src/app/allas/[slug]/application-form.tsx", import.meta.url), "utf8");
  const companyScript = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(applicationForm, /turnstile\?\.reset/);
  assert.ok(applicationForm.indexOf("form.reset()") > applicationForm.indexOf("if \(!response.ok\)"));
  assert.match(companyScript, /turnstileToken/);
  assert.match(companyScript, /window\.turnstile\.reset/);
  assert.ok(companyScript.indexOf("form.reset()") > companyScript.indexOf("if \(!response.ok"));
});
