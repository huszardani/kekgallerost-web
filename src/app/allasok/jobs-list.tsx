import Link from "next/link";
import { activateScheduledJobs } from "@/lib/job-data";
import { formatSalary } from "@/lib/recruitment";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

export default async function JobsListPage() {
  await activateScheduledJobs();
  const supabase = createPublicSupabaseClient();
  const { data: jobs, error } = await supabase.from("jobs").select("*").eq("status", "published").order("published_at", { ascending: false });
  if (error) throw new Error(error.message);
  const companyIds = [...new Set(jobs.map((job) => job.company_id))];
  const { data: companies, error: companiesError } = companyIds.length ? await supabase.from("companies").select("id, name").in("id", companyIds) : { data: [], error: null };
  if (companiesError) throw new Error(companiesError.message);

  return <main className="page-shell">
    <p className="eyebrow">Álláskeresőknek</p><h1>Aktuális állások</h1><p className="lead">Válassz a nyitott pozíciók közül, és jelentkezz közvetlenül az állás saját oldalán.</p>
    <section aria-label="Aktuális állások" className="grid job-grid">{jobs.map((job) => {
      const salary = formatSalary(job); const location = [job.city, job.workplace_address].filter(Boolean).join(" · ") || job.location;
      return <article className="panel job-list-card" key={job.id}>{job.hero_image_url ? <div aria-label={`${job.title} – ${location ?? "állás"}`} className="job-list-image" role="img" style={{ backgroundImage: `url(${job.hero_image_url})`, backgroundPosition: `${job.hero_focus_x}% ${job.hero_focus_y}%` }} /> : null}<p className="eyebrow">{job.employer_label || companies.find((company) => company.id === job.company_id)?.name || "Kékgallérost partner"}</p><h2>{job.title}</h2><p>{job.short_description}</p><div className="muted-text">{[location, job.employment_fraction || job.employment_type, salary].filter(Boolean).join(" · ")}</div><Link className="button" href={`/allas/${job.slug}`}>Részletek és jelentkezés</Link></article>;
    })}{jobs.length === 0 ? <div className="panel empty-state"><h2>Jelenleg nincs nyitott állás.</h2><p>Nézz vissza később!</p></div> : null}</section>
  </main>;
}
