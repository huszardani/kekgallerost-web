import Link from "next/link";
import { signOutAction } from "@/app/auth/actions";
import { updateApplicationAction } from "@/app/partner/actions";
import { applicationStatusLabel, applicationStatuses } from "@/lib/applications";
import { requireRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function toBudapestInput(value: string | null) {
  if (!value) return "";
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Budapest",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hourCycle: "h23"
  });
  return formatter.format(new Date(value)).replace(" ", "T");
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("hu-HU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Budapest" }).format(new Date(value))
    : "—";
}

export default async function PartnerDashboard() {
  const profile = await requireRole("partner");
  const supabase = await createServerSupabaseClient();
  const [companyResult, jobsResult] = await Promise.all([
    supabase.from("companies").select("*").eq("id", profile.company_id!).single(),
    supabase.from("jobs").select("*").order("created_at", { ascending: false })
  ]);
  if (companyResult.error) throw new Error(companyResult.error.message);
  if (jobsResult.error) throw new Error(jobsResult.error.message);

  const jobs = jobsResult.data ?? [];
  const jobIds = jobs.map((job) => job.id);
  const applicationsResult = jobIds.length
    ? await supabase.from("applications").select("*").in("job_id", jobIds).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (applicationsResult.error) throw new Error(applicationsResult.error.message);

  const applications = applicationsResult.data ?? [];
  const applicationIds = applications.map((application) => application.id);
  const [questionsResult, answersResult, filesResult] = await Promise.all([
    jobIds.length
      ? supabase.from("job_questions").select("*").in("job_id", jobIds).order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    applicationIds.length
      ? supabase.from("application_answers").select("*").in("application_id", applicationIds)
      : Promise.resolve({ data: [], error: null }),
    applicationIds.length
      ? supabase.from("uploaded_files").select("*").in("application_id", applicationIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  const firstError = questionsResult.error ?? answersResult.error ?? filesResult.error;
  if (firstError) throw new Error(firstError.message);

  const questions = questionsResult.data ?? [];
  const answers = answersResult.data ?? [];
  const files = filesResult.data ?? [];

  return (
    <main className="page-shell dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Partner · {companyResult.data.name}</p>
          <h1>Jelentkezések</h1>
          <p className="lead">Bejelentkezve: {profile.full_name ?? profile.email}. Az adatokat a cégazonosító alapján az RLS szűri.</p>
        </div>
        <div className="button-row">
          <Link className="button secondary" href="/api/partner/export">CSV export</Link>
          <form action={signOutAction}><button className="button secondary" type="submit">Kijelentkezés</button></form>
        </div>
      </header>

      {jobs.length === 0 ? <div className="panel empty-state">Ehhez a céghez még nincs álláshirdetés.</div> : null}

      <div className="stack-list">
        {jobs.map((job) => {
          const jobApplications = applications.filter((application) => application.job_id === job.id);
          return (
            <section className="panel partner-job" key={job.id}>
              <div className="section-heading">
                <div><p className="eyebrow">{job.status}</p><h2>{job.title}</h2><p className="muted-text">{job.location ?? "Helyszín nincs megadva"}</p></div>
                <span className="count-badge">{jobApplications.length} jelentkező</span>
              </div>
              {jobApplications.length === 0 ? <p className="muted-text">Még nincs jelentkező.</p> : null}
              <div className="stack-list">
                {jobApplications.map((application) => {
                  const applicationAnswers = answers.filter((answer) => answer.application_id === application.id);
                  const applicationFiles = files.filter((file) => file.application_id === application.id);
                  return (
                    <details className="subpanel application-card" key={application.id}>
                      <summary>
                        <span><strong>{application.applicant_name}</strong><span className="muted-text">{application.applicant_email}</span></span>
                        <span className={`status-pill ${application.status}`}>{applicationStatusLabel(application.status)}</span>
                      </summary>
                      <div className="application-meta">
                        <div><span>E-mail</span><a href={`mailto:${application.applicant_email}`}>{application.applicant_email}</a></div>
                        <div><span>Telefon</span>{application.applicant_phone ? <a href={`tel:${application.applicant_phone}`}>{application.applicant_phone}</a> : "—"}</div>
                        <div><span>Jelentkezett</span>{formatDate(application.created_at)}</div>
                        <div><span>Utolsó kapcsolat</span>{formatDate(application.last_contacted_at)}</div>
                      </div>

                      <h3>Válaszok</h3>
                      <dl className="answer-list">
                        {applicationAnswers.map((answer) => {
                          const question = questions.find((item) => item.id === answer.question_id);
                          const value = answer.answer_text ?? (answer.answer_json ? JSON.stringify(answer.answer_json) : "—");
                          return <div key={answer.id}><dt>{question?.question_text ?? "Kérdés"}</dt><dd>{value}</dd></div>;
                        })}
                        {applicationAnswers.length === 0 ? <div><dt>Válaszok</dt><dd>Nincs külön válasz.</dd></div> : null}
                      </dl>

                      <h3>Fájlok</h3>
                      <div className="file-list">
                        {applicationFiles.map((file) => (
                          <Link className="button secondary" href={`/api/files/${file.id}`} key={file.id}>{file.original_filename}</Link>
                        ))}
                        {applicationFiles.length === 0 ? <span className="muted-text">Nincs feltöltött fájl.</span> : null}
                      </div>

                      <form action={updateApplicationAction} className="form-grid application-update-form">
                        <input name="application_id" type="hidden" value={application.id} />
                        <label>Státusz<select defaultValue={application.status} name="status">{applicationStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
                        <label>Visszahívás (budapesti idő)<input defaultValue={toBudapestInput(application.callback_at)} name="callback_at" type="datetime-local" /></label>
                        <label>Utolsó kapcsolat (budapesti idő)<input defaultValue={toBudapestInput(application.last_contacted_at)} name="last_contacted_at" type="datetime-local" /></label>
                        <label className="full-field">Partner megjegyzés<textarea defaultValue={application.partner_note ?? ""} name="partner_note" rows={4} /></label>
                        <button className="button" type="submit">Jelentkező mentése</button>
                      </form>
                    </details>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

