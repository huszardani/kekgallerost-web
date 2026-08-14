import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  allowedResumeMimeTypes, answerMatchesRule, applicationStatuses, canTransitionJob,
  isAllowedJobImage, isAllowedResume, isValidSlug, jobStatuses, maxJobImageSize,
  maxResumeSize, normalizeList, questionTypes, sanitizeFilename
} from "../src/lib/recruitment.ts";
import { authorizeApplicationFileDownload, type ApplicationFileDownloadDependencies } from "../src/lib/application-file-download.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const applicationRoute = read("src/app/api/applications/route.ts");
const applicationForm = read("src/app/allas/[slug]/application-form.tsx");
const publicJobPage = read("src/app/allas/[slug]/job-page.tsx");
const publicRoute = read("src/app/allas/[slug]/page.tsx");
const template = read("src/app/allas/[slug]/job-template.tsx");
const editor = read("src/app/admin/allasok/job-form.tsx");
const adminActions = read("src/app/admin/crm-actions.ts");
const adminPreview = read("src/app/admin/allasok/[id]/elozetes/page.tsx");
const publicSiteFrame = read("src/app/_components/public-site-frame.tsx");
const publicJobsCss = read("src/app/public-jobs.css");
const adminCss = read("src/app/admin/admin.css");
const mediaRoute = read("src/app/api/admin/job-media/route.ts");
const emailSource = read("src/lib/email/application-email-queue.ts");
const partnerDashboard = read("src/app/partner/dashboard.tsx");
const crmMigration = read("supabase/migrations/202607180001_admin_crm.sql");
const dynamicMigration = read("supabase/migrations/202607200001_dynamic_job_pages.sql");
const emailRetryMigration = read("supabase/migrations/202608140001_application_email_delivery_retry_hardening.sql");

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

test("a publikus állásoldal a helyi statikus sablon szakaszait és szövegeit követi", () => {
  assert.match(template, /view.quickFacts/);
  assert.match(template, /Munkakör röviden/);
  assert.match(template, /Amit adunk/);
  assert.match(template, /Kitöltöm a jelentkezést/);
  assert.match(template, /a pozícióhoz kapcsolódó jelentkezésedet/);
  assert.doesNotMatch(template, /kg-compensation-section/);
  assert.doesNotMatch(template, /kg-trust-panel/);
  for (const field of ["applicant_city", "start_availability", "call_time", "has_experience", "commute_possible", "schedule_accepted", "application_note"]) assert.match(applicationForm, new RegExp(field));
  assert.match(applicationRoute, /standardAnswerRows/);
  assert.match(applicationRoute, /message: applicationNote/);
});
test("az adminból egy kattintással létrehozható a helyi mintát követő állásoldal", () => {
  assert.match(editor, /applyLocalReferencePreset/);
  assert.match(editor, /Helyi állásoldal-sablon betöltése/);
  assert.match(editor, /localReferenceVisibleBlocks/);
  for (const fact of ["salary", "location", "schedule", "start", "commute", "main-requirement"]) assert.match(editor, new RegExp(`data-quick-fact="${fact}"`));
  assert.match(editor, /updateFact\("schedule", "Kezdés"/);
  assert.match(editor, /updateMainRequirement/);
  assert.match(adminCss, /admin-quick-facts-grid/);
  assert.match(adminCss, /admin-template-preset-content/);
});

test("a részletező fejléc a helyi navigációt, az álláslista pedig a kiemelt Állások gombot használja", () => {
  assert.equal(publicSiteFrame.includes('{detail ? <Link href="/allasok">Állások'), true);
  assert.match(publicSiteFrame, /className="kg-jobs-nav-link"/);
  assert.equal(publicSiteFrame.includes('href="/allasok"'), true);
  assert.doesNotMatch(publicSiteFrame, /aria-hidden/);
  assert.equal(publicJobsCss.includes("@media (max-width: 520px)"), true);
  assert.equal(publicJobsCss.includes(".kg-brand-copy { display: none; }"), true);
  assert.equal(publicJobsCss.includes("@media (max-width: 360px)"), true);
  assert.equal(publicJobsCss.includes(".kg-jobs-nav-link"), true);
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
  assert.match(applicationForm, /Önéletrajz feltöltése, ha van/);
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
  assert.match(emailRetryMigration, /'application_email:' \|\| role \|\| ':' \|\| p_application_id::text/);
  assert.match(emailRetryMigration, /on conflict \(delivery_key\) where delivery_key is not null do nothing/);
  assert.match(emailSource, /sendIdempotentEmail\([\s\S]*delivery\.deliveryKey/);
  const sendIndex = applicationRoute.indexOf("const { emailStatus } = await runPostPersistenceEmailWorkflow");
  assert.equal(applicationRoute.indexOf('from("applications").delete', sendIndex), -1);
  assert.ok(sendIndex > applicationRoute.lastIndexOf('from("application_answers").insert'));
  assert.ok(sendIndex > applicationRoute.lastIndexOf('from("uploaded_files").insert'));
});

const fileDownloadId = "00000000-0000-4000-8000-000000000001";
const applicationId = "00000000-0000-4000-8000-000000000002";
const jobId = "00000000-0000-4000-8000-000000000003";
const ownCompanyId = "00000000-0000-4000-8000-000000000004";
const otherCompanyId = "00000000-0000-4000-8000-000000000005";

type DownloadFixture = {
  file?: { applicationId: string; storageBucket: string; storagePath: string } | null;
  application?: { jobId: string } | null;
  job?: { companyId: string } | null;
  signedUrl?: string | null;
};

function createDownloadDependencies(fixture: DownloadFixture = {}) {
  const calls = { file: 0, application: 0, job: 0, signed: 0 };
  const order: string[] = [];
  const file = fixture.file === undefined
    ? { applicationId, storageBucket: "application-files", storagePath: `applications/${applicationId}/synthetic-test.pdf` }
    : fixture.file;
  const application = fixture.application === undefined ? { jobId } : fixture.application;
  const job = fixture.job === undefined ? { companyId: ownCompanyId } : fixture.job;
  const signedUrl = fixture.signedUrl === undefined ? "https://storage.example.test/signed" : fixture.signedUrl;
  const dependencies: ApplicationFileDownloadDependencies = {
    async getFile() { calls.file += 1; order.push("file"); return file; },
    async getApplication() { calls.application += 1; order.push("application"); return application; },
    async getJob() { calls.job += 1; order.push("job"); return job; },
    async createSignedUrl() { calls.signed += 1; order.push("signed"); return signedUrl; }
  };
  return { calls, dependencies, order };
}

test("a jelentkezői dokumentum letöltési jogosultsága végrehajthatóan ellenőrzött", async (t) => {
  await t.test("be nem jelentkezett felhasználó 401-et kap, signed URL nélkül", async () => {
    const fixture = createDownloadDependencies();
    const result = await authorizeApplicationFileDownload(null, fileDownloadId, fixture.dependencies);
    assert.deepEqual(result, { kind: "error", status: 401, error: "Nincs bejelentkezve." });
    assert.equal(fixture.calls.signed, 0);
  });

  await t.test("admin szabályos fájljához signed URL készül", async () => {
    const fixture = createDownloadDependencies();
    const result = await authorizeApplicationFileDownload({ role: "admin", company_id: null }, fileDownloadId, fixture.dependencies);
    assert.deepEqual(result, { kind: "signed", signedUrl: "https://storage.example.test/signed" });
    assert.equal(fixture.calls.signed, 1);
  });

  await t.test("saját céges partner szabályos fájljához signed URL készül", async () => {
    const fixture = createDownloadDependencies();
    const result = await authorizeApplicationFileDownload({ role: "partner", company_id: ownCompanyId }, fileDownloadId, fixture.dependencies);
    assert.equal(result.kind, "signed");
    assert.equal(fixture.calls.signed, 1);
    assert.deepEqual(fixture.order, ["file", "application", "job", "signed"]);
  });

  await t.test("másik cég partnere 404-et kap signed URL nélkül", async () => {
    const fixture = createDownloadDependencies({ job: { companyId: otherCompanyId } });
    const result = await authorizeApplicationFileDownload({ role: "partner", company_id: ownCompanyId }, fileDownloadId, fixture.dependencies);
    assert.equal(result.kind, "error");
    assert.equal(result.status, 404);
    assert.equal(fixture.calls.signed, 0);
  });

  await t.test("company_id nélküli partner 404-et kap signed URL nélkül", async () => {
    const fixture = createDownloadDependencies();
    const result = await authorizeApplicationFileDownload({ role: "partner", company_id: null }, fileDownloadId, fixture.dependencies);
    assert.equal(result.kind, "error");
    assert.equal(result.status, 404);
    assert.equal(fixture.calls.file, 0);
    assert.equal(fixture.calls.signed, 0);
  });

  await t.test("hibás UUID 400-at, hiányzó fájl és adatbázishiba 404-et ad", async () => {
    const invalidFixture = createDownloadDependencies();
    const invalid = await authorizeApplicationFileDownload({ role: "admin", company_id: null }, "invalid", invalidFixture.dependencies);
    assert.equal(invalid.kind, "error");
    assert.equal(invalid.status, 400);
    assert.equal(invalidFixture.calls.signed, 0);
    for (const fixture of [createDownloadDependencies({ file: null }), createDownloadDependencies({ application: null })]) {
      const result = await authorizeApplicationFileDownload({ role: "admin", company_id: null }, fileDownloadId, fixture.dependencies);
      assert.equal(result.kind, "error");
      assert.equal(result.status, 404);
      assert.equal(fixture.calls.signed, 0);
    }
  });

  await t.test("nem engedélyezett bucket és hibás storage path 404-et ad", async () => {
    for (const fixture of [
      createDownloadDependencies({ file: { applicationId, storageBucket: "other-bucket", storagePath: `applications/${applicationId}/synthetic-test.pdf` } }),
      createDownloadDependencies({ file: { applicationId, storageBucket: "application-files", storagePath: "applications/other/synthetic-test.pdf" } })
    ]) {
      const result = await authorizeApplicationFileDownload({ role: "admin", company_id: null }, fileDownloadId, fixture.dependencies);
      assert.equal(result.kind, "error");
      assert.equal(result.status, 404);
      assert.equal(fixture.calls.signed, 0);
    }
  });

  assert.match(partnerDashboard, /files\.filter\(\(file\) => file\.application_id === application\.id\)/);
  assert.match(partnerDashboard, /href=\{`\/api\/files\/\$\{file\.id\}`\}/);
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
