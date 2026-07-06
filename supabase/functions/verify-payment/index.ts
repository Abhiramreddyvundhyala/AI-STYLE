/**
 * Verify Payment — Supabase Edge Function
 *
 * POST /functions/v1/verify-payment
 *
 * Security:
 * - Auth required (JWT verified)
 * - HMAC-SHA256 signature verification using RAZORPAY_KEY_SECRET
 * - Idempotency check via payment_id UNIQUE constraint
 * - Atomic credit add via Postgres function (FOR UPDATE)
 * - Rate limited: 10 req/min per user
 *
 * Request body: {
 *   razorpay_payment_id: string,
 *   razorpay_order_id: string,
 *   razorpay_signature: string
 * }
 * Response: { success: true, credits_added, free_credits_remaining, paid_credits }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Compute HMAC-SHA256 using Web Crypto API (available in Deno)
 */
async function computeHmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) =>
    console.log(`[verify-payment][${requestId}] ${msg}`, data ?? '');

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

    log('Authenticated user', user.id);

    // ── 2. Rate limiting ────────────────────────────────────────────────────
    const rateLimit = await checkRateLimit(
      adminClient,
      user.id,
      'verify-payment',
      RATE_LIMITS['verify-payment']
    );

    if (!rateLimit.allowed) {
      log('Rate limited', user.id);
      return rateLimitResponse(rateLimit.resetAt, corsHeaders);
    }

    // ── 3. Parse request body ───────────────────────────────────────────────
    const body = await req.json();
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return new Response(
        JSON.stringify({
          error: 'razorpay_payment_id, razorpay_order_id, and razorpay_signature are required',
          code: 'VALIDATION_ERROR',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 4. Verify Razorpay HMAC signature ───────────────────────────────────
    const secret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!secret) {
      log('ERROR: RAZORPAY_KEY_SECRET not set');
      return new Response(
        JSON.stringify({ error: 'Payment service not configured', code: 'CONFIG_ERROR' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = await computeHmacSha256(secret, payload);

    if (expectedSignature !== razorpay_signature) {
      log('Signature verification FAILED', {
        user: user.id,
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
      });
      return new Response(
        JSON.stringify({ error: 'Invalid payment signature', code: 'INVALID_SIGNATURE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log('Signature verified ✓', { order_id: razorpay_order_id });

    // ── 5. Verify transaction belongs to this user ──────────────────────────
    const { data: txn } = await adminClient
      .from('transactions')
      .select('id, user_id, status, credits_added_snapshot')
      .eq('order_id', razorpay_order_id)
      .single();

    if (txn && txn.user_id !== user.id) {
      log('ERROR: Transaction user_id mismatch', { expected: user.id, actual: txn.user_id });
      return new Response(
        JSON.stringify({ error: 'Transaction does not belong to this user', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 6. Atomically add credits (with idempotency via Postgres function) ──
    const { data: result, error: creditError } = await adminClient.rpc(
      'add_credits_after_payment',
      {
        p_payment_id: razorpay_payment_id,
        p_order_id: razorpay_order_id,
      }
    );

    if (creditError) {
      log('ERROR: add_credits_after_payment failed', creditError.message);

      if (creditError.message?.includes('TRANSACTION_NOT_FOUND')) {
        return new Response(
          JSON.stringify({ error: 'Transaction not found', code: 'TRANSACTION_NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to process payment', code: 'DB_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const alreadyCaptured = result?.already_captured ?? false;
    const creditsAdded = result?.credits_added ?? 0;

    log('Credits processed', {
      already_captured: alreadyCaptured,
      credits_added: creditsAdded,
      user: user.id,
    });

    // ── 7. Return updated balance ────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        already_captured: alreadyCaptured,
        credits_added: creditsAdded,
        free_credits_remaining: result?.free_credits_remaining ?? 0,
        paid_credits: result?.paid_credits ?? 0,
        total_credits: (result?.free_credits_remaining ?? 0) + (result?.paid_credits ?? 0),
        message: alreadyCaptured
          ? 'Payment already processed'
          : `${creditsAdded} credits added to your account!`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[verify-payment][${requestId}] Unhandled error:`, message);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
