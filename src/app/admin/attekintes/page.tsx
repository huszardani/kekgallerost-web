import Link from "next/link";
import { applicationStatusLabel, daysAgoIso, formatDateTime, jobStatusLabel } from "@/lib/recruitment";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const supabase = await createServerSupabaseClient();
  const [jobsResult, applicationsResult, companiesResult, activityResult] = await Promise.all([
    supabase.from("jobs").select("*").order("updated_at", { ascending: false }),
    supabase.from("applications").select("*").order("created_at", { ascending: false }),
    supabase.from("companies").select("id, name"),
    supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(8)
  ]);
  const error = jobsResult.error ?? applicationsResult.error ?? companiesResult.error ?? activityResult.error;
  if (error) throw new Error(error.message);

  const jobs = jobsResult.data ?? [];
  const applications = applicationsResult.data ?? [];
  const companies = companiesResult.data ?? [];
  const activity = activityResult.data ?? [];
  const since = Date.parse(daysAgoIso(30));
  const jobMap = new Map(jobs.map((job) => [job.id, job]));
  const companyMap = new Map(companies.map((company) => [company.id, company.name]));
  const countsByJob = new Map<string, number>();
  applications.forEach((application) => countsByJob.set(application.job_id, (countsByJob.get(application.job_id) ?? 0) + 1));

  const stats = [
    { label: "Publikált állások", value: jobs.filter((job) => job.status === "published").length, href: "/admin/allasok?status=published", note: "Jelenleg fogad jelentkezést" },
    { label: "Szüneteltetett állások", value: jobs.filter((job) => job.status === "paused").length, href: "/admin/allasok?status=paused", note: "Nem jelenik meg publikusan" },
    { label: "Új jelentkezések", value: applications.filter((item) => item.status === "new").length, href: "/admin/jelentkezok?status=new", note: "Még nincs átnézve" },
    { label: "Elmúlt 30 nap", value: applications.filter((item) => new Date(item.created_at).getTime() >= since).length, href: "/admin/jelentkezok?period=30", note: "Beérkezett jelentkezés" }
  ];

  return (
    <>
      <header className="admin-page-header">
        <div><span className="admin-eyebrow">Mai helyzetkép</span><h2>Áttekintés</h2><p>Az állások, jelentkezések és legutóbbi események egy helyen.</p></div>
        <div className="admin-actions"><Link className="admin-button secondary" href="/admin/jelentkezok">Jelentkezők megnyitása</Link><Link className="admin-button" href="/admin/allasok/uj">+ Új állás</Link></div>
      </header>

      <section className="admin-stat-grid" aria-label="Fő statisztikák">
        {stats.map((stat) => <Link className="admin-card admin-stat" href={stat.href} key={stat.label}><span className="admin-stat-label">{stat.label}</span><strong>{stat.value}</strong><small>{stat.note}</small></Link>)}
      </section>

      <div className="admin-dashboard-grid">
        <section className="admin-card">
          <h3>Legutóbbi jelentkezések</h3>
          {applications.slice(0, 7).map((application) => {
            const job = jobMap.get(application.job_id);
            return <Link className="admin-list-row" href={`/admin/jelentkezok/${application.id}`} key={application.id}><span><strong>{application.applicant_name}</strong><small>{job?.title ?? "Ismeretlen állás"} · {formatDateTime(application.created_at)}</small></span><span className={`admin-status ${application.status}`}>{applicationStatusLabel(application.status)}</span></Link>;
          })}
          {applications.length === 0 ? <div className="admin-empty"><strong>Még nincs jelentkező</strong>Az új jelentkezések itt jelennek meg.</div> : null}
        </section>

        <section className="admin-card">
          <h3>Jelentkezők állásonként</h3>
          <div className="admin-job-count-list">
            {jobs.slice(0, 7).map((job) => <Link className="admin-list-row" href={`/admin/allasok/${job.id}#jelentkezok`} key={job.id}><span><strong>{job.title}</strong><small>{companyMap.get(job.company_id) ?? "—"} · {jobStatusLabel(job.status)}</small></span><span className="admin-count">{countsByJob.get(job.id) ?? 0}</span></Link>)}
          </div>
        </section>

        <section className="admin-card">
          <h3>Legutóbb módosított állások</h3>
          {jobs.slice(0, 6).map((job) => <Link className="admin-list-row" href={`/admin/allasok/${job.id}`} key={job.id}><span><strong>{job.title}</strong><small>{formatDateTime(job.updated_at)}</small></span><span className={`admin-status ${job.status}`}>{jobStatusLabel(job.status)}</span></Link>)}
        </section>

        <section className="admin-card">
          <h3>Rendszeraktivitás</h3>
          <div className="admin-activity-list">
            {activity.map((item) => <div className="admin-list-row" key={item.id}><span><strong>{item.action === "status_changed" ? "Státuszváltozás" : "Rendszeresemény"}</strong><small>{item.previous_value ? `${item.previous_value} → ${item.new_value}` : item.new_value ?? "—"}</small></span><small>{formatDateTime(item.created_at)}</small></div>)}
            {activity.length === 0 ? <div className="admin-empty">Még nincs naplózott aktivitás.</div> : null}
          </div>
        </section>
      </div>
    </>
  );
}
