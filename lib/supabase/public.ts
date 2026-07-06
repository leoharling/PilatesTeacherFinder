import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Anon client for reading teachers_public from server components. No cookies.
export function createSupabasePublicClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
