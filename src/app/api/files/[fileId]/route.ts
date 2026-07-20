import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type FileRouteProps = { params: Promise<{ fileId: string }> };

export async function GET(_request: Request, { params }: FileRouteProps) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Nincs bejelentkezve." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "A dokumentumot csak adminisztrátor töltheti le." }, { status: 403 });
  const { fileId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return NextResponse.json({ error: "Érvénytelen fájlazonosító." }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data: file, error } = await supabase.from("uploaded_files").select("storage_bucket, storage_path").eq("id", fileId).single();
  if (error || !file) return NextResponse.json({ error: "A fájl nem található." }, { status: 404 });
  const { data: signed, error: signedError } = await supabase.storage.from(file.storage_bucket).createSignedUrl(file.storage_path, 60);
  if (signedError) return NextResponse.json({ error: "A letöltési link nem hozható létre." }, { status: 403 });
  return NextResponse.redirect(signed.signedUrl);
}
