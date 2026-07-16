import { notFound } from "next/navigation";
import ApplicationForm from "@/app/allas/[slug]/application-form";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

type JobDetailPageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export default async function JobDetail({ params }: JobDetailPageProps) {
  const { slug } = await params;
  const supabase = createPublicSupabaseClient();
  const { data: job, error } = await supabase.from("jobs").select("*").eq("slug", slug).eq("status", "published").single();
  if (error || !job) notFound();

  const [companyResult, questionsResult] = await Promise.all([
    supabase.from("companies").select("*").eq("id", job.company_id).single(),
    supabase.from("job_questions").select("*").eq("job_id", job.id).order("sort_order")
  ]);
  if (companyResult.error || !companyResult.data) notFound();
  if (questionsResult.error) throw new Error(questionsResult.error.message);
  const company = companyResult.data;

  return (
    <main>
      <section className="job-hero" style={job.hero_image_url ? { backgroundImage: `linear-gradient(90deg, rgba(9,30,66,.9), rgba(9,30,66,.55)), url(${JSON.stringify(job.hero_image_url).slice(1, -1)})` } : undefined}>
        <div className="page-shell job-hero-inner">
          <p className="eyebrow light">{company.name}</p>
          <h1>{job.title}</h1>
          <p className="lead light">{job.short_description}</p>
          <div className="job-facts"><span>{job.location ?? "Helyszín egyeztetés szerint"}</span><span>{job.employment_type ?? "Foglalkoztatás egyeztetés szerint"}</span>{job.salary_text ? <span>{job.salary_text}</span> : null}</div>
        </div>
      </section>
      <div className="page-shell job-layout">
        <article className="panel job-description">
          <p className="eyebrow">Az állásról</p>
          <h2>{job.title}</h2>
          <div className="preline-text">{job.description ?? job.short_description ?? "A részletekért jelentkezz az űrlapon."}</div>
          {company.description ? <><h2>A cégről</h2><div className="preline-text">{company.description}</div></> : null}
        </article>
        <ApplicationForm jobId={job.id} questions={questionsResult.data ?? []} />
      </div>
    </main>
  );
}

