/**
 * Supabase client factory
 * Creates admin (service role) and user-scoped clients
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// Warn loudly but DON'T exit — server must bind to port so Render health checks pass.
// Routes that call adminClient will fail with a clear error if vars are missing.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('⚠️  WARNING: Missing Supabase environment variables!');
  console.error('   SUPABASE_URL set:              ', !!process.env.SUPABASE_URL);
  console.error('   SUPABASE_ANON_KEY set:         ', !!process.env.SUPABASE_ANON_KEY);
  console.error('   SUPABASE_SERVICE_ROLE_KEY set: ', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Admin client — bypasses RLS. Use for server-side DB writes. */
export const adminClient: SupabaseClient = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

/**
 * Create a user-scoped client from an Authorization header.
 * Respects Supabase RLS policies.
 */
export function userScopedClient(authHeader: string): SupabaseClient {
  return createClient(
    SUPABASE_URL || 'https://placeholder.supabase.co',
    SUPABASE_ANON_KEY || 'placeholder-key',
    { global: { headers: { Authorization: authHeader } } }
  );
}
