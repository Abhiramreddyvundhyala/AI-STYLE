/**
 * Credits Transactions — Supabase Edge Function
 *
 * GET /functions/v1/credits-transactions?page=1&page_size=20
 *
 * Returns paginated transaction history for the authenticated user.
 *
 * Response: { data: Transaction[], total, page, page_size, has_more }
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

    // ── 2. Parse pagination params ──────────────────────────────────────────
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('page_size') ?? '20', 10)));
    const offset = (page - 1) * pageSize;

    // ── 3. Fetch transactions ───────────────────────────────────────────────
    const { data: transactions, error: txnError, count } = await adminClient
      .from('transactions')
      .select(
        'id, package_name_snapshot, credits_added_snapshot, amount, currency, status, payment_id, order_id, created_at',
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (txnError) {
      console.error(`[credits-transactions][${requestId}] DB error:`, txnError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch transactions', code: 'DB_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const total = count ?? 0;

    return new Response(
      JSON.stringify({
        data: transactions ?? [],
        total,
        page,
        page_size: pageSize,
        has_more: offset + pageSize < total,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[credits-transactions][${requestId}] Unhandled error:`, message);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
