import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';

// Service-role client: bypasses RLS. Use only for trusted server operations.
export const supabaseAdmin: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Build a per-request client scoped to the caller's JWT (RLS-enforced).
export function supabaseForUser(jwt: string): SupabaseClient {
  return createClient(config.supabase.url, config.supabase.anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
