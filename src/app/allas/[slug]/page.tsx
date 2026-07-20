import type { Metadata } from "next";
import JobDetail from "@/app/allas/[slug]/job-page";
import { loadPublishedJobPage, siteUrl } from "@/lib/job-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await loadPublishedJobPage(slug);
  if (!bundle) return { title: "Állás nem található", robots: { index: false, follow: false } };
  const { job, view } = bundle;
  const title = `${job.title} – ${view.companyName}`;
  const description = (job.short_description || job.description || `${job.title} álláslehetőség`).slice(0, 160);
  const canonical = `${siteUrl()}/allas/${job.slug}`;
  const image = view.socialImage ? (view.socialImage.startsWith("http") ? view.socialImage : `${siteUrl()}${view.socialImage}`) : undefined;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: "website", url: canonical, images: image ? [{ url: image, alt: job.hero_image_alt || job.title }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
    robots: { index: true, follow: true }
  };
}

export default JobDetail;
