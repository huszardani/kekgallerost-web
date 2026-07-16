import Link from "next/link";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

export default async function JobsListPage() {
  const supabase = createPublicSupabaseClient();
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, title, slug, short_description, location, employment_type, salary_text, company_id")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (error) throw new Error(error.message);

  const companyIds = [...new Set(jobs.map((job) => job.company_id))];
  const { data: companies, error: companiesError } = companyIds.length
    ? await supabase.from("companies").select("id, name").in("id", companyIds)
    : { data: [], error: null };
  if (companiesError) throw new Error(companiesError.message);

  return (
    <main className="page-shell">
      <p className="eyebrow">Álláskeresőknek</p>
      <h1>Aktuális állások</h1>
      <p className="lead">Itt kizárólag a Supabase-ben publikált álláshirdetések jelennek meg.</p>
      <section className="grid job-grid" aria-label="Aktuális állások">
        {jobs.map((job) => (
          <article className="panel job-list-card" key={job.id}>
            <p className="eyebrow">{companies.find((company) => company.id === job.company_id)?.name ?? "Kékgallérost partner"}</p>
            <h2>{job.title}</h2>
            <p>{job.short_description}</p>
            <div className="muted-text">{[job.location, job.employment_type, job.salary_text].filter(Boolean).join(" · ")}</div>
            <Link className="button" href={`/allas/${job.slug}`}>Részletek és jelentkezés</Link>
          </article>
        ))}
        {jobs.length === 0 ? <div className="panel empty-state"><h2>Jelenleg nincs nyitott állás.</h2><p>Nézz vissza később!</p></div> : null}
      </section>
    </main>
  );
}

