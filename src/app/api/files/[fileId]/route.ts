import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type FileRouteProps = { params: Promise<{ fileId: string }> };

export async function GET(_request: Request, { params }: FileRouteProps) {
  const { fileId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Nincs bejelentkezve." }, { status: 401 });

  const { data: file, error } = await supabase
    .from("uploaded_files")
    .select("storage_bucket, storage_path")
    .eq("id", fileId)
    .single();
  if (error || !file) return NextResponse.json({ error: "A fájl nem található." }, { status: 404 });

  const { data: signed, error: signedError } = await supabase.storage
    .from(file.storage_bucket)
    .createSignedUrl(file.storage_path, 60);
  if (signedError) return NextResponse.json({ error: signedError.message }, { status: 403 });
  return NextResponse.redirect(signed.signedUrl);
}

