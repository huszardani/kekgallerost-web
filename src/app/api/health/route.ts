import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

function isSet(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export async function GET() {
  const envStatus = {
    NEXT_PUBLIC_SUPABASE_URL: isSet(env.supabaseUrl),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: isSet(env.supabaseAnonKey),
    SUPABASE_SERVICE_ROLE_KEY: isSet(env.supabaseServiceRoleKey),
    RESEND_API_KEY: isSet(env.resendApiKey),
    EMAIL_FROM: isSet(env.emailFrom),
    NEXT_PUBLIC_SITE_URL: isSet(env.siteUrl)
  };

  let supabaseStatus: "ok" | "not_configured" | "error" = "not_configured";
  let supabaseError: string | null = null;

  if (env.supabaseUrl && env.supabaseAnonKey) {
    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { error } = await supabase.from("jobs").select("id").limit(1);

    if (error) {
      supabaseStatus = "error";
      supabaseError = error.message;
    } else {
      supabaseStatus = "ok";
    }
  }

  const ok = Object.values(envStatus).every(Boolean) && supabaseStatus === "ok";

  return NextResponse.json(
    {
      ok,
      service: "kekgallerost-web",
      checks: {
        env: envStatus,
        supabase: {
          status: supabaseStatus,
          error: supabaseError
        },
        resend: {
          configured: envStatus.RESEND_API_KEY,
          fromConfigured: envStatus.EMAIL_FROM
        }
      }
    },
    { status: ok ? 200 : 503 }
  );
}