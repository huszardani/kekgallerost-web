import Link from "next/link";
import { signOutAction } from "@/app/auth/actions";
import {
  addQuestionAction,
  assignPartnerCompanyAction,
  createCompanyAction,
  createJobAction,
  deleteQuestionAction,
  invitePartnerAction,
  updateCompanyAction,
  updateJobAction,
  updateQuestionAction
} from "@/app/admin/actions";
import { requireRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json, QuestionType } from "@/lib/supabase/database.types";

const jobStatuses = ["draft", "published", "closed", "archived"] as const;
const questionTypes: Array<{ value: QuestionType; label: string }> = [
  { value: "text", label: "Rövid szöveg" },
  { value: "textarea", label: "Hosszú szöveg" },
  { value: "select", label: "Egy választás" },
  { value: "multiselect", label: "Több választás" },
  { value: "boolean", label: "Igen / nem" },
  { value: "phone", label: "Telefonszám" },
  { value: "email", label: "E-mail" },
  { value: "file", label: "Fájl" }
];

function optionsToText(options: Json) {
  return Array.isArray(options) ? options.filter((item): item is string => typeof item === "string").join(", ") : "";
}

export default async function AdminDashboard() {
  const profile = await requireRole("admin");
  const supabase = await createServerSupabaseClient();
  const [companiesResult, profilesResult, jobsResult, questionsResult] = await Promise.all([
    supabase.from("companies").select("*").order("name"),
    supabase.from("profiles").select("*").order("email"),
    supabase.from("jobs").select("*").order("created_at", { ascending: false }),
    supabase.from("job_questions").select("*").order("sort_order")
  ]);

  const firstError = companiesResult.error ?? profilesResult.error ?? jobsResult.error ?? questionsResult.error;
  if (firstError) throw new Error(firstError.message);

  const companies = companiesResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const jobs = jobsResult.data ?? [];
  const questions = questionsResult.data ?? [];

  return (
    <main className="page-shell dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Adatbázis és tartalomkezelés</h1>
          <p className="lead">Bejelentkezve: {profile.full_name ?? profile.email}</p>
        </div>
        <form action={signOutAction}><button className="button secondary" type="submit">Kijelentkezés</button></form>
      </header>

      <nav className="button-row" aria-label="Admin szakaszok">
        <a className="button secondary" href="#companies">Cégek</a>
        <a className="button secondary" href="#partners">Partnerek</a>
        <a className="button secondary" href="#jobs">Állások és kérdések</a>
        <Link className="button secondary" href="/allasok">Publikus állások</Link>
      </nav>

      <section className="dashboard-section" id="companies">
        <div className="section-heading">
          <div><p className="eyebrow">1</p><h2>Cégek</h2></div>
          <span className="count-badge">{companies.length} cég</span>
        </div>
        <form action={createCompanyAction} className="panel form-grid">
          <h3 className="form-title">Új cég</h3>
          <label>Név<input name="name" required /></label>
          <label>Slug<input name="slug" pattern="[a-z0-9-]+" required /></label>
          <label>Kapcsolati e-mail<input name="contact_email" type="email" /></label>
          <label>Kapcsolati telefon<input name="contact_phone" /></label>
          <label>Logó URL<input name="logo_url" type="url" /></label>
          <label>Borítókép URL<input name="cover_image_url" type="url" /></label>
          <label>Státusz<select defaultValue="active" name="status"><option value="active">Aktív</option><option value="inactive">Inaktív</option></select></label>
          <label className="full-field">Leírás<textarea name="description" rows={3} /></label>
          <button className="button" type="submit">Cég létrehozása</button>
        </form>

        <div className="stack-list">
          {companies.map((company) => (
            <details className="panel" key={company.id}>
              <summary><strong>{company.name}</strong><span className={`status-pill ${company.status}`}>{company.status}</span></summary>
              <form action={updateCompanyAction} className="form-grid details-form">
                <input name="company_id" type="hidden" value={company.id} />
                <label>Név<input defaultValue={company.name} name="name" required /></label>
                <label>Slug<input defaultValue={company.slug} name="slug" pattern="[a-z0-9-]+" required /></label>
                <label>Kapcsolati e-mail<input defaultValue={company.contact_email ?? ""} name="contact_email" type="email" /></label>
                <label>Kapcsolati telefon<input defaultValue={company.contact_phone ?? ""} name="contact_phone" /></label>
                <label>Logó URL<input defaultValue={company.logo_url ?? ""} name="logo_url" type="url" /></label>
                <label>Borítókép URL<input defaultValue={company.cover_image_url ?? ""} name="cover_image_url" type="url" /></label>
                <label>Státusz<select defaultValue={company.status} name="status"><option value="active">Aktív</option><option value="inactive">Inaktív</option></select></label>
                <label className="full-field">Leírás<textarea defaultValue={company.description ?? ""} name="description" rows={3} /></label>
                <button className="button" type="submit">Módosítások mentése</button>
              </form>
            </details>
          ))}
        </div>
      </section>

      <section className="dashboard-section" id="partners">
        <div className="section-heading"><div><p className="eyebrow">2</p><h2>Partner felhasználók</h2></div></div>
        <form action={invitePartnerAction} className="panel form-grid">
          <h3 className="form-title">Partner meghívása és céghez rendelése</h3>
          <label>Teljes név<input name="full_name" required /></label>
          <label>E-mail<input name="email" required type="email" /></label>
          <label>Cég<select name="company_id" required><option value="">Válassz céget</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
          <button className="button" type="submit">Meghívás küldése</button>
        </form>
        <div className="stack-list">
          {profiles.filter((item) => item.role === "partner").map((partner) => (
            <form action={assignPartnerCompanyAction} className="panel inline-form" key={partner.id}>
              <input name="profile_id" type="hidden" value={partner.id} />
              <div><strong>{partner.full_name ?? partner.email}</strong><div className="muted-text">{partner.email}</div></div>
              <label>Cég<select defaultValue={partner.company_id ?? ""} name="company_id" required>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
              <button className="button secondary" type="submit">Hozzárendelés mentése</button>
            </form>
          ))}
        </div>
      </section>

      <section className="dashboard-section" id="jobs">
        <div className="section-heading"><div><p className="eyebrow">3</p><h2>Állások és kérdések</h2></div><span className="count-badge">{jobs.length} állás</span></div>
        <form action={createJobAction} className="panel form-grid">
          <h3 className="form-title">Új álláshirdetés</h3>
          <label>Cég<select name="company_id" required><option value="">Válassz céget</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
          <label>Cím<input name="title" required /></label>
          <label>Slug<input name="slug" pattern="[a-z0-9-]+" required /></label>
          <label>Helyszín<input name="location" /></label>
          <label>Foglalkoztatás<input name="employment_type" /></label>
          <label>Bér szövege<input name="salary_text" /></label>
          <label>Hero kép URL<input name="hero_image_url" type="url" /></label>
          <label>Státusz<select defaultValue="draft" name="status">{jobStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="full-field">Rövid leírás<textarea name="short_description" rows={2} /></label>
          <label className="full-field">Részletes leírás<textarea name="description" rows={6} /></label>
          <button className="button" type="submit">Állás létrehozása</button>
        </form>

        <div className="stack-list">
          {jobs.map((job) => {
            const jobQuestions = questions.filter((question) => question.job_id === job.id);
            return (
              <details className="panel job-admin-card" key={job.id}>
                <summary>
                  <span><strong>{job.title}</strong><span className="muted-text">/{job.slug}</span></span>
                  <span className={`status-pill ${job.status}`}>{job.status}</span>
                </summary>
                <form action={updateJobAction} className="form-grid details-form">
                  <input name="job_id" type="hidden" value={job.id} />
                  <label>Cég<select defaultValue={job.company_id} name="company_id" required>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
                  <label>Cím<input defaultValue={job.title} name="title" required /></label>
                  <label>Slug<input defaultValue={job.slug} name="slug" pattern="[a-z0-9-]+" required /></label>
                  <label>Helyszín<input defaultValue={job.location ?? ""} name="location" /></label>
                  <label>Foglalkoztatás<input defaultValue={job.employment_type ?? ""} name="employment_type" /></label>
                  <label>Bér szövege<input defaultValue={job.salary_text ?? ""} name="salary_text" /></label>
                  <label>Hero kép URL<input defaultValue={job.hero_image_url ?? ""} name="hero_image_url" type="url" /></label>
                  <label>Státusz<select defaultValue={job.status} name="status">{jobStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
                  <label className="full-field">Rövid leírás<textarea defaultValue={job.short_description ?? ""} name="short_description" rows={2} /></label>
                  <label className="full-field">Részletes leírás<textarea defaultValue={job.description ?? ""} name="description" rows={6} /></label>
                  <button className="button" type="submit">Állás mentése</button>
                  {job.status === "published" ? <Link className="button secondary" href={`/allas/${job.slug}`}>Publikus oldal</Link> : null}
                </form>

                <div className="question-admin-block">
                  <h3>Jelentkezési kérdések</h3>
                  {jobQuestions.map((question) => (
                    <div className="subpanel" key={question.id}>
                      <form action={updateQuestionAction} className="form-grid compact-grid">
                        <input name="question_id" type="hidden" value={question.id} />
                        <label>Kérdés<input defaultValue={question.question_text} name="question_text" required /></label>
                        <label>Típus<select defaultValue={question.question_type} name="question_type">{questionTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
                        <label>Sorrend<input defaultValue={question.sort_order} name="sort_order" type="number" /></label>
                        <label>Opciók<input defaultValue={optionsToText(question.options)} name="options" placeholder="vesszővel elválasztva" /></label>
                        <label className="checkbox-label"><input defaultChecked={question.is_required} name="is_required" type="checkbox" /> Kötelező</label>
                        <button className="button secondary" type="submit">Kérdés mentése</button>
                      </form>
                      <form action={deleteQuestionAction} className="danger-row">
                        <input name="question_id" type="hidden" value={question.id} />
                        <button className="text-button danger" type="submit">Kérdés törlése</button>
                      </form>
                    </div>
                  ))}
                  <form action={addQuestionAction} className="subpanel form-grid compact-grid">
                    <input name="job_id" type="hidden" value={job.id} />
                    <label>Új kérdés<input name="question_text" required /></label>
                    <label>Típus<select name="question_type">{questionTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
                    <label>Sorrend<input defaultValue={(jobQuestions.at(-1)?.sort_order ?? 0) + 10} name="sort_order" type="number" /></label>
                    <label>Opciók<input name="options" placeholder="vesszővel elválasztva" /></label>
                    <label className="checkbox-label"><input name="is_required" type="checkbox" /> Kötelező</label>
                    <button className="button" type="submit">Kérdés hozzáadása</button>
                  </form>
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </main>
  );
}

