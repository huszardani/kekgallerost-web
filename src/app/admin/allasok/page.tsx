import Link from "next/link";
import { ConfirmForm } from "@/app/admin/_components/ui";
import { changeJobStatusAction, duplicateJobAction } from "@/app/admin/crm-actions";
import { formatDateTime, jobStatusLabel, jobStatuses } from "@/lib/recruitment";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { JobStatus } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";
const pageSize = 12;

function valueOf(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
function pageUrl(params: Record<string, string | string[] | undefined>, page: number) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { const text = valueOf(value); if (text && key !== "page" && key !== "saved") query.set(key, text); });
  query.set("page", String(page));
  return `/admin/allasok?${query}`;
}

export default async function AdminJobsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const search = valueOf(params.search).trim();
  const status = valueOf(params.status);
  const companyId = valueOf(params.company);
  const location = valueOf(params.location).trim();
  const dateFrom = valueOf(params.date_from);
  const page = Math.max(1, Number(valueOf(params.page)) || 1);
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("jobs").select("*", { count: "exact" }).order("updated_at", { ascending: false });
  if (search) query = query.or(`title.ilike.%${search.replace(/[%_,]/g, "")}%,location.ilike.%${search.replace(/[%_,]/g, "")}%`);
  if (jobStatuses.some((item) => item.value === status)) query = query.eq("status", status as JobStatus);
  if (companyId) query = query.eq("company_id", companyId);
  if (location) query = query.ilike("location", `%${location.replace(/[%_]/g, "")}%`);
  if (dateFrom) query = query.gte("updated_at", dateFrom);
  const [jobsResult, companiesResult, applicationsResult] = await Promise.all([
    query.range((page - 1) * pageSize, page * pageSize - 1),
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("applications").select("id, job_id, status")
  ]);
  const error = jobsResult.error ?? companiesResult.error ?? applicationsResult.error;
  if (error) throw new Error(error.message);
  const jobs = jobsResult.data ?? [];
  const companies = companiesResult.data ?? [];
  const applications = applicationsResult.data ?? [];
  const companyMap = new Map(companies.map((company) => [company.id, company.name]));
  const totalPages = Math.max(1, Math.ceil((jobsResult.count ?? 0) / pageSize));
  const returnTo = `/admin/allasok?${new URLSearchParams(Object.entries(params).flatMap(([key, value]) => { const text = valueOf(value); return text ? [[key, text]] : []; })).toString()}`;

  return (
    <>
      <header className="admin-page-header">
        <div><span className="admin-eyebrow">Tartalom és életciklus</span><h2>Állások</h2><p>Keresés, szűrés, publikálás és az állásonként beérkezett jelentkezések kezelése.</p></div>
        <Link className="admin-button" href="/admin/allasok/uj">+ Új állás</Link>
      </header>
      {params.saved === "1" ? <div className="admin-feedback" role="status">A művelet sikeresen megtörtént.</div> : null}
      <form className="admin-card admin-filterbar" method="get">
        <label className="admin-field">Keresés<input className="admin-input" defaultValue={search} name="search" placeholder="Állás neve vagy helyszín" /></label>
        <label className="admin-field">Státusz<select className="admin-select" defaultValue={status} name="status"><option value="">Minden státusz</option>{jobStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="admin-field">Cég<select className="admin-select" defaultValue={companyId} name="company"><option value="">Minden cég</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label className="admin-field">Módosítva ettől<input className="admin-input" defaultValue={dateFrom} name="date_from" type="date" /></label>
        <button className="admin-button" type="submit">Szűrés</button>
      </form>

      <section className="admin-card admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Állás</th><th>Cég / helyszín</th><th>Státusz</th><th>Jelentkezők</th><th>Publikálva</th><th>Módosítva</th><th>Műveletek</th></tr></thead>
          <tbody>
            {jobs.map((job) => {
              const jobApplications = applications.filter((application) => application.job_id === job.id);
              const newCount = jobApplications.filter((application) => application.status === "new").length;
              return <tr key={job.id}>
                <td><strong>{job.title}</strong><small>/{job.slug}</small></td>
                <td><strong>{companyMap.get(job.company_id) ?? "—"}</strong><small>{job.location ?? "Helyszín nincs megadva"}</small></td>
                <td><span className={`admin-status ${job.status}`}>{jobStatusLabel(job.status)}</span></td>
                <td><strong>{jobApplications.length}</strong><small>{newCount} új</small></td>
                <td>{formatDateTime(job.published_at)}</td><td>{formatDateTime(job.updated_at)}</td>
                <td><div className="admin-table-actions">
                  <Link className="admin-button secondary small" href={`/admin/allasok/${job.id}`}>Megnyitás</Link>
                  <Link className="admin-button secondary small" href={`/admin/allasok/${job.id}#hirdetes`}>Szerkesztés</Link>
                  <Link className="admin-button secondary small" href={`/admin/allasok/${job.id}/elozetes`}>Előnézet</Link>
                  {job.status === "draft" ? <form action={changeJobStatusAction}><input name="job_id" type="hidden" value={job.id} /><input name="status" type="hidden" value="published" /><input name="return_to" type="hidden" value={returnTo} /><button className="admin-button small" type="submit">Publikálás</button></form> : null}
                  {job.status === "published" ? <form action={changeJobStatusAction}><input name="job_id" type="hidden" value={job.id} /><input name="status" type="hidden" value="paused" /><input name="return_to" type="hidden" value={returnTo} /><button className="admin-button warning small" type="submit">Szüneteltetés</button></form> : null}
                  {job.status === "paused" ? <form action={changeJobStatusAction}><input name="job_id" type="hidden" value={job.id} /><input name="status" type="hidden" value="published" /><input name="return_to" type="hidden" value={returnTo} /><button className="admin-button small" type="submit">Újrapublikálás</button></form> : null}
                  {job.status === "closed" ? <ConfirmForm action={changeJobStatusAction} message="Biztosan újranyitod és publikálod ezt az állást?"><input name="job_id" type="hidden" value={job.id} /><input name="status" type="hidden" value="published" /><input name="return_to" type="hidden" value={returnTo} /><button className="admin-button small" type="submit">Újranyitás</button></ConfirmForm> : null}
                  {job.status === "published" || job.status === "paused" ? <ConfirmForm action={changeJobStatusAction} message="Biztosan lezárod ezt az állást? A jelentkezések megmaradnak."><input name="job_id" type="hidden" value={job.id} /><input name="status" type="hidden" value="closed" /><input name="return_to" type="hidden" value={returnTo} /><button className="admin-button danger small" type="submit">Lezárás</button></ConfirmForm> : null}
                  <form action={duplicateJobAction}><input name="job_id" type="hidden" value={job.id} /><button className="admin-button secondary small" type="submit">Duplikálás</button></form>
                </div></td>
              </tr>;
            })}
          </tbody>
        </table>
        {jobs.length === 0 ? <div className="admin-empty"><strong>Nincs találat</strong>Módosítsd a szűrőket, vagy hozz létre új állást.</div> : null}
      </section>
      <nav className="admin-pagination" aria-label="Lapozás"><span>{jobsResult.count ?? 0} állás · {page}/{totalPages}. oldal</span>{page > 1 ? <Link className="admin-button secondary small" href={pageUrl(params, page - 1)}>Előző</Link> : null}{page < totalPages ? <Link className="admin-button secondary small" href={pageUrl(params, page + 1)}>Következő</Link> : null}</nav>
    </>
  );
}
