import "server-only";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/database.types";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data || !data.is_active) {
    return null;
  }

  return data;
}

export async function requireRole(role: "admin" | "partner") {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect(`/bejelentkezes?next=/${role}`);
  }

  if (profile.role !== role) {
    redirect(profile.role === "admin" ? "/admin" : "/partner");
  }

  if (role === "partner" && !profile.company_id) {
    redirect("/bejelentkezes?error=missing-company");
  }

  return profile;
}

