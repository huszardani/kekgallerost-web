"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";

export function createBrowserSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase public environment variables.");
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}