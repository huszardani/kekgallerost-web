import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JobPageTemplate from "@/app/allas/[slug]/job-template";
import { buildJobPageView } from "@/lib/job-page";
import { jobStatusLabel } from "@/lib/recruitment";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function JobPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const supabase = await createServerSupabaseClient();
  const [jobResult, blocksResult, mediaResult] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", id).single(),
    supabase.from("job_content_blocks").select("*").eq("job_id", id).order("sort_order"),
    supabase.from("job_media").select("*").eq("job_id", id).order("sort_order")
  ]);
  if (jobResult.error || !jobResult.data) notFound();
  const { data: company } = await supabase.from("companies").select("*").eq("id", jobResult.data.company_id).single();
  if (!company) notFound(); const blocks = blocksResult.data ?? [];
  const { data: items } = blocks.length ? await supabase.from("job_content_items").select("*").in("block_id", blocks.map((block) => block.id)).order("sort_order") : { data: [] };
  const view = buildJobPageView({ job: jobResult.data, company, blocks, items: items ?? [], media: mediaResult.data ?? [] });
  return <><header className="admin-page-header"><div><span className="admin-eyebrow">Admin előnézet · {jobStatusLabel(jobResult.data.status)}</span><h2>{jobResult.data.title}</h2><p>Az előnézet ugyanazt a központi komponenst használja, mint a publikus oldal, és nem teszi közzé az állást.</p></div><Link className="admin-button secondary" href={`/admin/allasok/${jobResult.data.id}`}>Vissza a szerkesztőhöz</Link></header><div className="admin-full-preview"><JobPageTemplate preview view={view} /></div></>;
}
