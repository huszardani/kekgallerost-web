import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { authorizeApplicationFileDownload } from "@/lib/application-file-download";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type FileRouteProps = { params: Promise<{ fileId: string }> };

export async function GET(_request: Request, { params }: FileRouteProps) {
  const profile = await getCurrentProfile();
  const { fileId } = await params;
  const supabase = await createServerSupabaseClient();
  const result = await authorizeApplicationFileDownload(profile, fileId, {
    async getFile(id) {
      const { data, error } = await supabase
        .from("uploaded_files")
        .select("application_id, storage_bucket, storage_path")
        .eq("id", id)
        .single();
      return error || !data ? null : { applicationId: data.application_id, storageBucket: data.storage_bucket, storagePath: data.storage_path };
    },
    async getApplication(applicationId) {
      const { data, error } = await supabase.from("applications").select("job_id").eq("id", applicationId).single();
      return error || !data ? null : { jobId: data.job_id };
    },
    async getJob(jobId, companyId) {
      const { data, error } = await supabase.from("jobs").select("company_id").eq("id", jobId).eq("company_id", companyId).single();
      return error || !data ? null : { companyId: data.company_id };
    },
    async createSignedUrl(bucket, path) {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
      return error || !data ? null : data.signedUrl;
    }
  });

  return result.kind === "signed"
    ? NextResponse.redirect(result.signedUrl)
    : NextResponse.json({ error: result.error }, { status: result.status });
}
