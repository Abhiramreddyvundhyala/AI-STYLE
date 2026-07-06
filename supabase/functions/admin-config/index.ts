/**
 * Admin Config — Supabase Edge Function
 *
 * Requires: JWT claim role = 'admin'
 *
 * GET /functions/v1/admin-config       → Get all config key-value pairs
 * PUT /functions/v1/admin-config       → Update config values
 *
 * Managed keys:
 *   - free_generations_per_month  (int)
 *   - credits_per_generation      (int)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_CONFIG_KEYS = ['free_generations_per_month', 'credits_per_generation'];

async function getAdminUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: adminRecord } = await adminClient
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single();

  if (!adminRecord) return null;

  return { user, adminClient };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) =>
    console.log(`[admin-config][${requestId}] ${msg}`, data ?? '');

  try {
    // ── 1. Admin auth check ─────────────────────────────────────────────────
    const admin = await getAdminUser(req);
    if (!admin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { adminClient } = admin;

    // ── GET: Return all config ──────────────────────────────────────────────
    if (req.method === 'GET') {
      const { data: config, error } = await adminClient
        .from('admin_config')
        .select('key, value, updated_at')
        .in('key', ALLOWED_CONFIG_KEYS);

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch config', code: 'DB_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transform to key-value object for convenience
      const configMap = (config ?? []).reduce((acc: Record<string, string>, row: { key: string; value: string }) => {
        acc[row.key] = row.value;
        return acc;
      }, {});

      return new Response(
        JSON.stringify({ data: configMap, raw: config }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── PUT: Update config values ───────────────────────────────────────────
    if (req.method === 'PUT') {
      const body = await req.json();

      for (const [key, value] of Object.entries(body)) {
        if (!ALLOWED_CONFIG_KEYS.includes(key)) {
          return new Response(
            JSON.stringify({
              error: `Unknown config key: ${key}. Allowed: ${ALLOWED_CONFIG_KEYS.join(', ')}`,
              code: 'VALIDATION_ERROR',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const numVal = parseInt(String(value), 10);
        if (isNaN(numVal) || numVal < 1) {
          return new Response(
            JSON.stringify({
              error: `${key} must be a positive integer`,
              code: 'VALIDATION_ERROR',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: upsertError } = await adminClient
          .from('admin_config')
          .upsert({ key, value: String(numVal), updated_at: new Date().toISOString() }, { onConflict: 'key' });

        if (upsertError) {
          return new Response(
            JSON.stringify({ error: `Failed to update ${key}`, code: 'DB_ERROR' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        log('Config updated', { key, value: numVal });
      }

      // Return updated config
      const { data: config } = await adminClient
        .from('admin_config')
        .select('key, value, updated_at')
        .in('key', ALLOWED_CONFIG_KEYS);

      const configMap = (config ?? []).reduce((acc: Record<string, string>, row: { key: string; value: string }) => {
        acc[row.key] = row.value;
        return acc;
      }, {});

      return new Response(
        JSON.stringify({ data: configMap, message: 'Config updated successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[admin-config][${requestId}] Unhandled error:`, message);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
