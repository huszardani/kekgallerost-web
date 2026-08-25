import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isPartnerApplicationStatus,
  partnerApplicationStatusLabel,
  partnerApplicationStatusFromForm,
  partnerApplicationStatuses
} from "../src/lib/partner-applications.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const partnerAction = read("src/app/partner/actions.ts");
const partnerDashboard = read("src/app/partner/dashboard.tsx");
const partnerMigration = read("supabase/migrations/202608240001_partner_crm_statuses.sql");
const rlsTests = read("supabase/tests/rls.sql");

test("partner status list has the required six values, order, and Hungarian labels", () => {
  assert.deepEqual(partnerApplicationStatuses, [
    { value: "new", label: "Új" },
    { value: "reviewed", label: "Felhívandó" },
    { value: "contacted", label: "Felhívva" },
    { value: "interview", label: "Interjú" },
    { value: "rejected", label: "Elutasítva" },
    { value: "hired", label: "Felvéve" }
  ]);
  assert.equal(isPartnerApplicationStatus("not_qualified"), false);
  assert.equal(partnerApplicationStatusLabel("reviewed"), "Felhívandó");
  assert.equal(partnerApplicationStatusLabel("contacted"), "Felhívva");
  assert.equal(partnerApplicationStatusLabel("not_qualified"), "Feltételnek nem felel meg");
  assert.equal(isPartnerApplicationStatus("withdrawn"), false);
});

test("partner action only forwards permitted statuses and preserves status with null", () => {
  assert.equal(partnerApplicationStatusFromForm(null), null);
  assert.equal(partnerApplicationStatusFromForm(""), null);
  assert.equal(partnerApplicationStatusFromForm("reviewed"), "reviewed");
  assert.throws(() => partnerApplicationStatusFromForm("not_qualified"), /Érvénytelen partneri/);
  assert.throws(() => partnerApplicationStatusFromForm("withdrawn"), /Érvénytelen partneri/);
  assert.match(partnerAction, /p_status: status/);
  assert.match(partnerAction, /await requireRole\("partner"\)/);
});

test("partner UI shows special statuses without making them selectable", () => {
  assert.match(partnerDashboard, /isPartnerApplicationStatus\(application\.status\)/);
  assert.match(partnerDashboard, /partnerApplicationStatuses\.map/);
  assert.match(partnerDashboard, /Ez a státusz partnerként nem módosítható/);
  assert.match(partnerDashboard, /partnerApplicationStatusLabel\(application\.status\)/);
  assert.doesNotMatch(partnerDashboard, /applicationStatuses\.map/);
});

test("RPC and RLS regression coverage limit writes and company scope", () => {
  assert.match(partnerMigration, /'new', 'reviewed', 'contacted', 'interview', 'rejected', 'hired'/);
  assert.doesNotMatch(partnerMigration, /'withdrawn'/);
  assert.match(partnerMigration, /status = coalesce\(p_status, application\.status\)/);
  assert.match(partnerMigration, /public\.is_partner_for_company\(job\.company_id\)/);
  assert.match(rlsTests, /partner saw another company application/);
  assert.match(rlsTests, /partner directly updated a protected application column/);
  assert.match(rlsTests, /partner updated another company application/);
});
