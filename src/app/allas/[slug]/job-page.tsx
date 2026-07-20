import { notFound } from "next/navigation";
import ApplicationForm from "@/app/allas/[slug]/application-form";
import JobPageTemplate from "@/app/allas/[slug]/job-template";
import { loadPublishedJobPage, siteUrl } from "@/lib/job-data";

type JobDetailPageProps = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export default async function JobDetail({ params }: JobDetailPageProps) {
  const { slug } = await params;
  const bundle = await loadPublishedJobPage(slug);
  if (!bundle) notFound();

  const { job, company, questions, questionOptions, view } = bundle;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description || job.short_description || job.title,
    datePosted: job.published_at,
    validThrough: job.application_deadline ? `${job.application_deadline}T23:59:59+02:00` : undefined,
    employmentType: job.employment_fraction || job.employment_type || undefined,
    hiringOrganization: { "@type": "Organization", name: company.name, sameAs: company.website_url || undefined },
    jobLocation: (job.city || job.workplace_address || job.location) ? {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.city || job.location || undefined,
        streetAddress: job.workplace_address || undefined,
        addressCountry: "HU"
      }
    } : undefined,
    url: `${siteUrl()}/allas/${job.slug}`
  };

  return <>
    <script dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} type="application/ld+json" />
    <JobPageTemplate
      application={<ApplicationForm jobId={job.id} questionOptions={questionOptions} questions={questions} resumeEnabled={job.resume_enabled} />}
      view={view}
    />
  </>;
}
