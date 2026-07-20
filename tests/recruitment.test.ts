import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  allowedResumeMimeTypes, answerMatchesRule, applicationStatuses, canTransitionJob,
  isAllowedJobImage, isAllowedResume, isValidSlug, jobStatuses, maxJobImageSize,
  maxResumeSize, normalizeList, questionTypes, sanitizeFilename
} from "../src/lib/recruitment.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const applicationRoute = read("src/app/api/applications/route.ts");
const applicationForm = read("src/app/allas/[slug]/application-form.tsx");
const publicJobPage = read("src/app/allas/[slug]/job-page.tsx");
const publicRoute = read("src/app/allas/[slug]/page.tsx");
const template = read("src/app/allas/[slug]/job-template.tsx");
const editor = read("src/app/admin/allasok/job-form.tsx");
const adminActions = read("src/app/admin/crm-actions.ts");
const adminPreview = read("src/app/admin/allasok/[id]/elozetes/page.tsx");
const mediaRoute = read("src/app/api/admin/job-media/route.ts");
const emailSource = read("src/lib/email/application-confirmation.ts");
const fileRoute = read("src/app/api/files/[fileId]/route.ts");
const crmMigration = read("supabase/migrations/202607180001_admin_crm.sql");
const dynamicMigration = read("supabase/migrations/202607200001_dynamic_job_pages.sql");

test("csak aktív állás fogadhat publikus jelentkezést", () => {
  assert.match(applicationRoute, /\.eq\("status", "published"\)/);
  assert.deepEqual(jobStatuses.map((item) => item.value), ["draft", "ready", "published", "paused", "closed", "archived"]);
});

test("a teljes állás-életciklus következetes", () => {
  assert.equal(canTransitionJob("draft", "ready"), true);
  assert.equal(canTransitionJob("ready", "published"), true);
  assert.equal(canTransitionJob("published", "paused"), true);
  assert.equal(canTransitionJob("paused", "closed"), true);
  assert.equal(canTransitionJob("closed", "archived"), true);
  assert.equal(canTransitionJob("archived", "draft"), true);
  assert.equal(canTransitionJob("draft", "closed"), false);
});

test("a publikus oldal és mindkét admin előnézet ugyanazt a sablont használja", () => {
  assert.match(publicJobPage, /JobPageTemplate/);
  assert.match(editor, /JobPageTemplate/);
  assert.match(adminPreview, /JobPageTemplate/);
  assert.doesNotMatch(publicJobPage, /FuvarszervezoDetails/);
  assert.match(template, /kg-job-detail-hero/);
  assert.match(template, /PublicSiteFrame/);
});

test("a tartalmi blokkok és listaelemek normalizált táblákban vannak", () => {
  assert.match(dynamicMigration, /create table if not exists public\.job_content_blocks/);
  assert.match(dynamicMigration, /create table if not exists public\.job_content_items/);
  assert.match(adminActions, /content_blocks_json/);
  assert.match(editor, /Új .* hozzáadása/);
});

test("az üres listaelemek kiszűrődnek", () => {
  assert.deepEqual(normalizeList([" Első ", "", "  ", "Második"]), ["Első", "Második"]);
  assert.match(adminActions, /filter\(\(item\) => item\.body\)/);
});

test("minden kért kérdéstípus elérhető", () => {
  const values = questionTypes.map((item) => item.value);
  for (const type of ["text", "textarea", "radio", "multiselect", "boolean", "number", "date", "select", "file", "resume"]) assert.equal(values.includes(type as never), true);
  assert.match(applicationForm, /\? "checkbox" : "radio"/);
});

test("a kizáró szabály strukturált választ értékel", () => {
  assert.equal(answerMatchesRule("Nem", ["Nem"]), true);
  assert.equal(answerMatchesRule(["B", "C"], ["C"]), true);
  assert.equal(answerMatchesRule(true, ["false"]), false);
  assert.match(applicationRoute, /job_disqualification_rules/);
  assert.match(applicationRoute, /status: disqualified \? "not_qualified" : "new"/);
});

test("a slug keresőbarát és egyedi ellenőrzést kap", () => {
  assert.equal(isValidSlug("fuvarszervezo-budapest"), true);
  assert.equal(isValidSlug("Fuvarszervező Budapest"), false);
  assert.match(adminActions, /Ez a slug már foglalt/);
  assert.match(dynamicMigration, /unique \(job_id, block_type\)/);
});

test("az időzített publikálás időpontot és időzónát tárol", () => {
  assert.match(adminActions, /export async function scheduleJobAction/);
  assert.match(adminActions, /publish_timezone: "Europe\/Budapest"/);
  assert.match(dynamicMigration, /create or replace function public\.activate_scheduled_jobs/);
  assert.match(applicationRoute, /activateScheduledJobs/);
});

test("a duplikált állás piszkozat, másolja a tartalmat, de nem a jelentkezőket", () => {
  const body = adminActions.slice(adminActions.indexOf("export async function duplicateJobAction"), adminActions.indexOf("export async function saveQuestionAction"));
  assert.match(body, /status: "draft"/);
  assert.match(body, /job_content_blocks/);
  assert.match(body, /job_media/);
  assert.match(body, /job_questions/);
  assert.match(body, /scheduled_publish_at: null/);
  assert.doesNotMatch(body, /from\("applications"\)\.insert/);
});

test("a jelentkezés eltárolja a kérdések pillanatképét", () => {
  assert.match(applicationRoute, /question_label_snapshot: question\.question_text/);
  assert.match(crmMigration, /on delete set null/);
});

test("önéletrajz nélkül is beküldhető a jelentkezés", () => {
  assert.match(applicationForm, /Önéletrajz \(opcionális\)/);
  assert.doesNotMatch(applicationForm, /name="resume_file" required/);
});

test("csak ellenőrzött, legfeljebb 10 MB-os önéletrajz engedélyezett", () => {
  assert.equal(maxResumeSize, 10 * 1024 * 1024);
  assert.deepEqual([...allowedResumeMimeTypes], ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
  assert.equal(isAllowedResume({ size: 100, type: "application/pdf" } as File), true);
  assert.equal(isAllowedResume({ size: maxResumeSize + 1, type: "application/pdf" } as File), false);
  assert.match(applicationRoute, /matchesSignature\(item\.file, item\.buffer\)/);
});

test("az állásképek típusa és 8 MB-os méretkorlátja ellenőrzött", () => {
  assert.equal(maxJobImageSize, 8 * 1024 * 1024);
  assert.equal(isAllowedJobImage({ size: 100, type: "image/webp" } as File), true);
  assert.equal(isAllowedJobImage({ size: 100, type: "image/svg+xml" } as File), false);
  assert.match(mediaRoute, /imageSignature/);
  assert.match(dynamicMigration, /file_size_limit, allowed_mime_types/);
});

test("a generált fájlnév nem enged path traversalt", () => {
  const safe = sanitizeFilename("../../veszélyes önéletrajz.pdf");
  assert.equal(safe.includes(".."), false);
  assert.equal(safe.includes("/"), false);
  assert.equal(safe.endsWith(".pdf"), true);
});

test("minden CRM-státusz, köztük az automatikus kizárás rendelkezésre áll", () => {
  assert.deepEqual(applicationStatuses.map((item) => item.value), ["new", "reviewed", "contacted", "interview", "hired", "rejected", "withdrawn", "not_qualified"]);
});

test("belső megjegyzés és CRM-státusz nem kerül az e-mailbe", () => {
  assert.doesNotMatch(emailSource, /from\("application_notes"\)/);
  assert.doesNotMatch(emailSource, /partner_note/);
  assert.doesNotMatch(emailSource, /select\([^)]*status/);
});

test("az e-mail-küldés idempotens, hibája nem törli a jelentkezést", () => {
  assert.match(emailSource, /application_confirmation:\$\{application\.id\}/);
  assert.match(emailSource, /logError\.code === "23505"/);
  const sendIndex = applicationRoute.indexOf("const email = await sendApplicationConfirmationEmail");
  assert.equal(applicationRoute.indexOf('from("applications").delete', sendIndex), -1);
});

test("jelentkezői dokumentumot csak admin tölthet le", () => {
  assert.match(fileRoute, /profile\.role !== "admin"/);
  assert.match(fileRoute, /status: 403/);
});

test("az ismételt gyors beküldést a szerver blokkolja", () => {
  assert.match(applicationRoute, /5 \* 60 \* 1000/);
  assert.match(applicationRoute, /status: 429/);
});

test("dinamikus SEO, canonical, Open Graph és JobPosting készül", () => {
  assert.match(publicRoute, /generateMetadata/);
  assert.match(publicRoute, /alternates: \{ canonical \}/);
  assert.match(publicRoute, /openGraph/);
  assert.match(publicJobPage, /"@type": "JobPosting"/);
});
