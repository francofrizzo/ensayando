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

// Service-role client: bypasses RLS. Only for auth admin operations (create accounts,
// reset passwords, invitations) after the caller's permission was checked with their
// own token. Needs SUPABASE_SERVICE_ROLE_KEY in the Vercel project.
export function createServiceSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}
