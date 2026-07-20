"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function safeNextPath(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value : "/partner";
  return path.startsWith("/") && !path.startsWith("//") ? path : "/partner";
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = safeNextPath(formData.get("next"));
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/bejelentkezes?error=invalid-credentials&next=${encodeURIComponent(nextPath)}`);
  }

  redirect(nextPath);
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/bejelentkezes");
}

async function getPasswordRecoveryOrigin() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  const isLocalHost = host?.startsWith("localhost:") || host?.startsWith("127.0.0.1:");

  if (host && isLocalHost) {
    return "http://" + host;
  }

  try {
    return new URL(env.siteUrl).origin;
  } catch {
    return "https://kekgallerost.hu";
  }
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    redirect("/elfelejtett-jelszo?error=missing-email");
  }

  const supabase = await createServerSupabaseClient();
  const origin = await getPasswordRecoveryOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origin + "/auth/visszaallitas"
  });

  if (error) {
    redirect("/elfelejtett-jelszo?error=request-failed");
  }

  redirect("/elfelejtett-jelszo?sent=1");
}

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(formData.get("passwordConfirmation") ?? "");

  if (password.length < 12) {
    redirect("/uj-jelszo?error=password-too-short");
  }

  if (password !== passwordConfirmation) {
    redirect("/uj-jelszo?error=password-mismatch");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/bejelentkezes?error=recovery-session");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect("/uj-jelszo?error=update-failed");
  }

  await supabase.auth.signOut();
  redirect("/bejelentkezes?message=password-updated");
}

