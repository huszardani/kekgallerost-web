import "server-only";
import { buildJobPageView } from "@/lib/job-page";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function activateScheduledJobs() {
  const supabase = createServiceSupabaseClient();
  const { error } = await supabase.rpc("activate_scheduled_jobs");
  if (error) console.error("Scheduled publishing failed", error.message);
}

export async function loadPublishedJobPage(slug: string) {
  await activateScheduledJobs();
  const supabase = createPublicSupabaseClient();
  const { data: job, error } = await supabase.from("jobs").select("*").eq("slug", slug).eq("status", "published").single();
  if (error || !job) return null;
  const [companyResult, blocksResult, mediaResult, questionsResult] = await Promise.all([
    supabase.from("companies").select("*").eq("id", job.company_id).single(),
    supabase.from("job_content_blocks").select("*").eq("job_id", job.id).order("sort_order"),
    supabase.from("job_media").select("*").eq("job_id", job.id).order("sort_order"),
    supabase.from("job_questions").select("*").eq("job_id", job.id).order("sort_order")
  ]);
  if (companyResult.error || !companyResult.data) return null;
  if (blocksResult.error || mediaResult.error || questionsResult.error) throw new Error("Az állásoldal adatai nem tölthetők be.");

  const blocks = blocksResult.data ?? [];
  const questions = questionsResult.data ?? [];
  const [itemsResult, optionsResult] = await Promise.all([
    blocks.length ? supabase.from("job_content_items").select("*").in("block_id", blocks.map((block) => block.id)).order("sort_order") : Promise.resolve({ data: [], error: null }),
    questions.length ? supabase.from("job_question_options").select("*").in("question_id", questions.map((question) => question.id)).order("sort_order") : Promise.resolve({ data: [], error: null })
  ]);
  if (itemsResult.error || optionsResult.error) throw new Error("Az állásoldal tartalma nem tölthető be.");

  return {
    job,
    company: companyResult.data,
    blocks,
    items: itemsResult.data ?? [],
    media: mediaResult.data ?? [],
    questions,
    questionOptions: optionsResult.data ?? [],
    view: buildJobPageView({ job, company: companyResult.data, blocks, items: itemsResult.data ?? [], media: mediaResult.data ?? [] })
  };
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
