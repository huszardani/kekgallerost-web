"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function deleteApplicationAction(formData: FormData) {
  await requireRole("admin");
  const applicationId = String(formData.get("application_id") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim().toUpperCase();
  if (!/^[0-9a-f-]{36}$/i.test(applicationId) || confirmation !== "TÖRLÉS") throw new Error("A törlés megerősítése hibás.");
  const supabase = await createServerSupabaseClient();
  const { data: files, error: fileError } = await supabase.from("uploaded_files").select("storage_bucket, storage_path").eq("application_id", applicationId);
  if (fileError) throw new Error(fileError.message);
  const grouped = new Map<string, string[]>();
  for (const file of files ?? []) grouped.set(file.storage_bucket, [...(grouped.get(file.storage_bucket) ?? []), file.storage_path]);
  for (const [bucket, paths] of grouped) { const { error } = await supabase.storage.from(bucket).remove(paths); if (error) throw new Error("A kapcsolódó dokumentum nem törölhető biztonságosan."); }
  const { error } = await supabase.from("applications").delete().eq("id", applicationId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin", "layout");
  redirect("/admin/jelentkezok?deleted=1");
}
