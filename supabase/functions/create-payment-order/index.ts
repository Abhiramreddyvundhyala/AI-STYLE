/**
 * Create Payment Order — Supabase Edge Function
 *
 * POST /functions/v1/create-payment-order
 *
 * Security:
 * - Auth required (JWT verified)
 * - Package looked up server-side by package_id (never trust frontend amount)
 * - Rate limited: 10 req/min per user
 * - Creates Razorpay order with server-side amount
 * - Inserts transaction row with status = 'created'
 *
 * Request body: { package_id: string, currency?: 'INR' | 'USD' }
 * Response: { order_id, amount, currency, package_name, credits }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '../_shared/rateLimiter.ts';

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
    console.log(`[create-payment-order][${requestId}] ${msg}`, data ?? '');

  try {
    // ── 1. Verify auth ──────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // User client (respects RLS)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Admin client (bypasses RLS — used for rate limits & transactions)
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
      'create-order',
      RATE_LIMITS['create-order']
    );

    if (!rateLimit.allowed) {
      log('Rate limited', user.id);
      return rateLimitResponse(rateLimit.resetAt, corsHeaders);
    }

    // ── 3. Parse & validate request body ───────────────────────────────────
    const body = await req.json();
    const { package_id, currency = 'INR' } = body;

    if (!package_id || typeof package_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'package_id is required', code: 'VALIDATION_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only INR is charged via Razorpay; USD is reference pricing only
    const chargesCurrency = 'INR';

    // ── 4. Look up package server-side (NEVER trust frontend for price/credits) ──
    const { data: pkg, error: pkgError } = await adminClient
      .from('packages')
      .select('id, name, credits, price_inr, price_usd, is_active')
      .eq('id', package_id)
      .eq('is_active', true)
      .single();

    if (pkgError || !pkg) {
      log('Package not found', { package_id, error: pkgError?.message });
      return new Response(
        JSON.stringify({ error: 'Package not found or inactive', code: 'PACKAGE_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Server-side amount in paise (INR only)
    const amountInr = pkg.price_inr;
    const amountInPaise = Math.round(amountInr * 100);

    log('Package found', { name: pkg.name, credits: pkg.credits, price_inr: amountInr });

    // ── 5. Create Razorpay order ────────────────────────────────────────────
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      log('ERROR: Razorpay credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Payment service not configured', code: 'CONFIG_ERROR' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const razorpayAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${razorpayAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: chargesCurrency,
        receipt: `credits_${user.id.slice(0, 8)}_${Date.now()}`,
        notes: {
          user_id: user.id,
          package_id: pkg.id,
          package_name: pkg.name,
          credits: pkg.credits,
        },
      }),
    });

    if (!razorpayResponse.ok) {
      const rzpError = await razorpayResponse.json();
      log('Razorpay order creation failed', rzpError);
      return new Response(
        JSON.stringify({
          error: 'Failed to create payment order',
          code: 'RAZORPAY_ERROR',
          detail: rzpError?.error?.description,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const order = await razorpayResponse.json();
    log('Razorpay order created', { order_id: order.id });

    // ── 6. Insert transaction record with status = 'created' ────────────────
    const { error: txnError } = await adminClient.from('transactions').insert({
      user_id: user.id,
      package_id: pkg.id,
      package_name_snapshot: pkg.name,
      credits_added_snapshot: pkg.credits,
      amount: amountInr,
      currency: chargesCurrency,
      payment_gateway: 'razorpay',
      order_id: order.id,
      status: 'created',
    });

    if (txnError) {
      log('ERROR: Failed to insert transaction', txnError.message);
      // Don't block the user — order is created, log the error
      console.error(`[create-payment-order] DB insert failed for order ${order.id}:`, txnError.message);
    }

    // ── 7. Return order details to frontend ─────────────────────────────────
    return new Response(
      JSON.stringify({
        order_id: order.id,
        amount: amountInPaise,       // in paise for Razorpay checkout
        amount_inr: amountInr,       // human-readable amount
        currency: chargesCurrency,
        package_name: pkg.name,
        credits: pkg.credits,
        razorpay_key_id: razorpayKeyId, // Public key — safe to return
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[create-payment-order][${requestId}] Unhandled error:`, message);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
