import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createRequestSupabaseClient(authorization?: string): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL/VITE_SUPABASE_URL or anon key");
  }

  return createClient(url, anonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}
