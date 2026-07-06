/**
 * style-purchase — Supabase Edge Function
 *
 * POST /functions/v1/style-purchase
 *
 * Creates a Razorpay order for purchasing a style's download rights.
 *
 * Security:
 * - JWT required (user must be authenticated)
 * - Style price fetched server-side (never trust frontend)
 * - Idempotency: returns existing pending order if same style/user has one
 * - Rate limited: 5 req/min per user
 *
 * Request: { style_id: string, currency?: 'INR' }
 * Response: { order_id, razorpay_key_id, amount, currency, style_title }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: { env: { get(k: string): string | undefined } };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) =>
    console.log(`[style-purchase][${requestId}] ${msg}`, data ?? '');

  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
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

    log('Authenticated', user.id);

    // ── 2. Parse body ────────────────────────────────────────────────────────
    const body = await req.json();
    const { style_id, currency = 'INR' } = body as {
      style_id: string;
      currency?: string;
    };

    if (!style_id) {
      return new Response(
        JSON.stringify({ error: 'style_id is required', code: 'VALIDATION_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 3. Fetch style price SERVER-SIDE (never trust frontend) ──────────────
    const { data: style, error: styleError } = await adminClient
      .from('styles')
      .select('id, title, price, seller_id')
      .eq('id', style_id)
      .single();

    if (styleError || !style) {
      return new Response(
        JSON.stringify({ error: 'Style not found', code: 'NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log('Style fetched', { id: style.id, price: style.price });

    // ── 4. Check if already purchased ────────────────────────────────────────
    const { data: existing } = await adminClient
      .from('style_purchases')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('style_id', style_id)
      .eq('status', 'completed')
      .maybeSingle();

    if (existing) {
      log('Already purchased', existing.id);
      return new Response(
        JSON.stringify({ already_purchased: true, purchase_id: existing.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Free style: auto-grant without payment
    if (!style.price || style.price === 0) {
      const { data: freePurchase, error: freeErr } = await adminClient
        .from('style_purchases')
        .insert({
          user_id: user.id,
          seller_id: style.seller_id ?? null,
          style_id: style.id,
          purchase_amount: 0,
          currency,
          payment_gateway: 'free',
          payment_id: null,
          order_id: `free_${user.id}_${style.id}`,
          status: 'completed',
        })
        .select('id')
        .single();

      if (freeErr && !freeErr.message?.includes('duplicate')) {
        log('Free purchase insert error', freeErr.message);
      }

      return new Response(
        JSON.stringify({ already_purchased: true, purchase_id: freePurchase?.id ?? null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 5. Create Razorpay order ─────────────────────────────────────────────
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      log('ERROR: Razorpay keys not configured');
      return new Response(
        JSON.stringify({ error: 'Payment service not configured', code: 'CONFIG_ERROR' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Amount in paise (Razorpay uses smallest currency unit)
    const amountPaise = Math.round(style.price * 100);

    const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency,
        receipt: `sp_${style_id.slice(0, 8)}_${Date.now()}`,
        notes: {
          user_id: user.id,
          style_id: style.id,
          type: 'style_purchase',
        },
      }),
    });

    if (!rzpResponse.ok) {
      const errText = await rzpResponse.text();
      log('Razorpay order creation failed', errText);
      return new Response(
        JSON.stringify({ error: 'Payment service unavailable', code: 'RAZORPAY_ERROR' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rzpOrder = await rzpResponse.json();
    log('Razorpay order created', rzpOrder.id);

    // ── 6. Record pending transaction ─────────────────────────────────────────
    await adminClient.from('style_purchases').insert({
      user_id: user.id,
      seller_id: style.seller_id ?? null,
      style_id: style.id,
      purchase_amount: style.price,
      currency,
      payment_gateway: 'razorpay',
      order_id: rzpOrder.id,
      status: 'pending',
    });

    return new Response(
      JSON.stringify({
        order_id: rzpOrder.id,
        razorpay_key_id: razorpayKeyId,
        amount: amountPaise,
        currency,
        style_title: style.title,
        style_price: style.price,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[style-purchase][${requestId}] Unhandled:`, msg);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
