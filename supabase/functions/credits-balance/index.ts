/**
 * Credits Balance — Supabase Edge Function
 *
 * GET /functions/v1/credits-balance
 *
 * Returns the current credit balance for the authenticated user.
 * Runs monthly reset check if needed.
 *
 * Response: { free_credits_remaining, paid_credits, total_credits, last_credit_reset }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) =>
    console.log(`[credits-balance][${requestId}] ${msg}`, data ?? '');

  try {
    // ── 1. Verify auth ──────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'INVALID_TOKEN' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log('Fetching balance for user', user.id);

    // ── 2. Get balance (with monthly reset check via Postgres function) ──────
    const { data: balance, error: balanceError } = await adminClient.rpc('get_user_balance', {
      p_user_id: user.id,
    });

    if (balanceError) {
      log('ERROR: get_user_balance failed', balanceError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch balance', code: 'DB_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        free_credits_remaining: balance?.free_credits_remaining ?? 0,
        paid_credits: balance?.paid_credits ?? 0,
        total_credits: balance?.total_credits ?? 0,
        last_credit_reset: balance?.last_credit_reset,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[credits-balance][${requestId}] Unhandled error:`, message);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
