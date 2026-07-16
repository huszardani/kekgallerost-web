import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export async function createServerSupabaseClient() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("Missing Supabase public environment variables.");
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. Middleware or Route Handlers can.
        }
      }
    }
  });
}

export function createServiceSupabaseClient() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error("Missing Supabase service environment variables.");
  }

  return createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}