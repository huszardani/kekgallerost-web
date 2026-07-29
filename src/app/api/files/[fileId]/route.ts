import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type FileRouteProps = { params: Promise<{ fileId: string }> };

export async function GET(_request: Request, { params }: FileRouteProps) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Nincs bejelentkezve." }, { status: 401 });
  const { fileId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return NextResponse.json({ error: "Érvénytelen fájlazonosító." }, { status: 400 });
  if (profile.role !== "admin" && (profile.role !== "partner" || !profile.company_id)) {
    return NextResponse.json({ error: "A fájl nem található." }, { status: 404 });
  }
  const supabase = await createServerSupabaseClient();
  const { data: file, error } = await supabase
    .from("uploaded_files")
    .select("application_id, storage_bucket, storage_path")
    .eq("id", fileId)
    .eq("storage_bucket", "application-files")
    .single();
  if (error || !file) return NextResponse.json({ error: "A fájl nem található." }, { status: 404 });

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("job_id")
    .eq("id", file.application_id)
    .single();
  if (applicationError || !application || !file.storage_path.startsWith(`applications/${file.application_id}/`)) {
    return NextResponse.json({ error: "A fájl nem található." }, { status: 404 });
  }

  if (profile.role === "partner") {
    const companyId = profile.company_id;
    if (!companyId) return NextResponse.json({ error: "A fájl nem található." }, { status: 404 });
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("company_id")
      .eq("id", application.job_id)
      .eq("company_id", companyId)
      .single();
    if (jobError || !job) return NextResponse.json({ error: "A fájl nem található." }, { status: 404 });
  }

  const { data: signed, error: signedError } = await supabase.storage.from(file.storage_bucket).createSignedUrl(file.storage_path, 60);
  if (signedError) return NextResponse.json({ error: "A letöltési link nem hozható létre." }, { status: 403 });
  return NextResponse.redirect(signed.signedUrl);
}
