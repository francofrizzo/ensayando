import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "http://localhost";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "dummy";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
