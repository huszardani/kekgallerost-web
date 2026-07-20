import Link from "next/link";
import { updateApplicationStatusAction } from "@/app/admin/crm-actions";
import { applicationStatuses, daysAgoIso, formatDateTime } from "@/lib/recruitment";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ApplicationStatus } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";
const pageSize = 15;
function valueOf(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
function listUrl(params: Record<string, string | string[] | undefined>, changes: Record<string, string>) { const q = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { const text = valueOf(v); if (text && k !== "saved") q.set(k, text); }); Object.entries(changes).forEach(([k, v]) => v ? q.set(k, v) : q.delete(k)); return `/admin/jelentkezok?${q}`; }

export default async function AdminApplicationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const search = valueOf(params.search).trim();
  const jobId = valueOf(params.job);
  const status = valueOf(params.status);
  const dateFrom = valueOf(params.date_from);
  const hasCv = valueOf(params.has_cv);
  const visibility = valueOf(params.visibility);
  const view = valueOf(params.view) === "kanban" ? "kanban" : "table";
  const page = Math.max(1, Number(valueOf(params.page)) || 1);
  const supabase = await createServerSupabaseClient();
  let applicationsQuery = supabase.from("applications").select("*").order("created_at", { ascending: false });
  if (search) applicationsQuery = applicationsQuery.or(`applicant_name.ilike.%${search.replace(/[%_,]/g, "")}%,applicant_email.ilike.%${search.replace(/[%_,]/g, "")}%`);
  if (jobId) applicationsQuery = applicationsQuery.eq("job_id", jobId);
  if (applicationStatuses.some((item) => item.value === status)) applicationsQuery = applicationsQuery.eq("status", status as ApplicationStatus);
  if (dateFrom) applicationsQuery = applicationsQuery.gte("created_at", dateFrom);
  if (valueOf(params.period) === "30") applicationsQuery = applicationsQuery.gte("created_at", daysAgoIso(30));
  const [applicationsResult, jobsResult, companiesResult, filesResult] = await Promise.all([
    applicationsQuery,
    supabase.from("jobs").select("id, title, company_id").order("title"),
    supabase.from("companies").select("id, name"),
    supabase.from("uploaded_files").select("id, application_id")
  ]);
  const error = applicationsResult.error ?? jobsResult.error ?? companiesResult.error ?? filesResult.error;
  if (error) throw new Error(error.message);
  const jobs = jobsResult.data ?? [];
  const companies = companiesResult.data ?? [];
  const files = filesResult.data ?? [];
  const withFiles = new Set(files.map((file) => file.application_id));
  let filtered = applicationsResult.data ?? [];
  if (hasCv === "yes") filtered = filtered.filter((item) => withFiles.has(item.id));
  if (hasCv === "no") filtered = filtered.filter((item) => !withFiles.has(item.id));
  if (visibility === "new") filtered = filtered.filter((item) => item.status === "new");
  if (visibility === "viewed") filtered = filtered.filter((item) => item.status !== "new");
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const applications = view === "kanban" ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize);
  const jobMap = new Map(jobs.map((job) => [job.id, job]));
  const companyMap = new Map(companies.map((company) => [company.id, company.name]));
  const returnTo = listUrl(params, {});

  return <>
    <header className="admin-page-header"><div><span className="admin-eyebrow">Mini CRM</span><h2>Jelentkezők</h2><p>Az összes jelentkező, válasz, dokumentum és CRM-státusz központi nézete.</p></div><div className="admin-actions"><Link className={`admin-button ${view === "table" ? "" : "secondary"}`} href={listUrl(params, { view: "table", page: "1" })}>Táblázat</Link><Link className={`admin-button ${view === "kanban" ? "" : "secondary"}`} href={listUrl(params, { view: "kanban", page: "1" })}>Kanban</Link></div></header>
    {valueOf(params.saved) === "1" ? <div className="admin-feedback" role="status">A jelentkező adatai sikeresen frissültek.</div> : null}
    <form className="admin-card admin-filterbar" method="get"><input name="view" type="hidden" value={view} /><label className="admin-field">Név vagy e-mail<input className="admin-input" defaultValue={search} name="search" /></label><label className="admin-field">Állás<select className="admin-select" defaultValue={jobId} name="job"><option value="">Minden állás</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label><label className="admin-field">CRM-státusz<select className="admin-select" defaultValue={status} name="status"><option value="">Minden státusz</option>{applicationStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="admin-field">Önéletrajz<select className="admin-select" defaultValue={hasCv} name="has_cv"><option value="">Mindegy</option><option value="yes">Van</option><option value="no">Nincs</option></select></label><button className="admin-button" type="submit">Szűrés</button></form>
    <div className="admin-actions" style={{ marginBottom: 16 }}><Link className="admin-button secondary small" href={listUrl(params, { visibility: "new", page: "1" })}>Csak új</Link><Link className="admin-button secondary small" href={listUrl(params, { period: "30", page: "1" })}>Elmúlt 30 nap</Link><Link className="admin-button secondary small" href="/admin/jelentkezok">Szűrők törlése</Link></div>

    {view === "table" ? <section className="admin-card admin-table-wrap"><table className="admin-table"><thead><tr><th>Jelentkező</th><th>Állás</th><th>CRM-státusz</th><th>Jelentkezés</th><th>Önéletrajz</th><th>Módosítva</th><th></th></tr></thead><tbody>{applications.map((application) => { const job = jobMap.get(application.job_id); return <tr key={application.id}><td><strong>{application.applicant_name}</strong><small>{application.applicant_email} · {application.applicant_phone ?? "nincs telefon"}</small></td><td><strong>{job?.title ?? "—"}</strong><small>{job ? companyMap.get(job.company_id) ?? "—" : "—"}</small></td><td><form action={updateApplicationStatusAction} className="admin-actions"><input name="application_id" type="hidden" value={application.id} /><input name="return_to" type="hidden" value={returnTo} /><select aria-label="CRM-státusz" className="admin-select" defaultValue={application.status} name="status" style={{ minWidth: 145 }}>{applicationStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button className="admin-button secondary small" type="submit">Mentés</button></form></td><td>{formatDateTime(application.created_at)}</td><td>{withFiles.has(application.id) ? "Van" : "Nincs"}</td><td>{formatDateTime(application.updated_at)}</td><td><Link className="admin-button secondary small" href={`/admin/jelentkezok/${application.id}`}>Adatlap</Link></td></tr>; })}</tbody></table>{applications.length === 0 ? <div className="admin-empty"><strong>Nincs találat</strong>A megadott szűrőknek egy jelentkező sem felel meg.</div> : null}</section> : <section className="admin-kanban" aria-label="Jelentkezők Kanban nézete">{applicationStatuses.map((column) => { const items = applications.filter((item) => item.status === column.value); return <div className="admin-kanban-column" key={column.value}><h3>{column.label}<span className="admin-count">{items.length}</span></h3>{items.map((application) => <article className="admin-kanban-card" key={application.id}><Link href={`/admin/jelentkezok/${application.id}`}>{application.applicant_name}</Link><small>{jobMap.get(application.job_id)?.title ?? "—"}<br />{formatDateTime(application.created_at)}</small><form action={updateApplicationStatusAction}><input name="application_id" type="hidden" value={application.id} /><input name="return_to" type="hidden" value={returnTo} /><select aria-label="Új CRM-státusz" className="admin-select" defaultValue={application.status} name="status">{applicationStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button className="admin-button secondary small" style={{ marginTop: 7, width: "100%" }} type="submit">Státusz mentése</button></form></article>)}</div>; })}</section>}
    {view === "table" ? <nav className="admin-pagination" aria-label="Lapozás"><span>{filtered.length} jelentkező · {page}/{totalPages}. oldal</span>{page > 1 ? <Link className="admin-button secondary small" href={listUrl(params, { page: String(page - 1) })}>Előző</Link> : null}{page < totalPages ? <Link className="admin-button secondary small" href={listUrl(params, { page: String(page + 1) })}>Következő</Link> : null}</nav> : null}
  </>;
}
