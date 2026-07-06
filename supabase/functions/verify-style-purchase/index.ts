/**
 * verify-style-purchase — Supabase Edge Function
 *
 * POST /functions/v1/verify-style-purchase
 *
 * Verifies Razorpay HMAC signature and records a completed style purchase.
 *
 * Security:
 * - JWT required
 * - HMAC-SHA256 signature verification
 * - Idempotent via add_style_purchase Postgres function
 * - Ownership check: order must belong to authenticated user
 *
 * Request: {
 *   razorpay_payment_id, razorpay_order_id, razorpay_signature,
 *   style_id, seller_id?
 * }
 * Response: { success: true, purchase_id, already_purchased }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: { env: { get(k: string): string | undefined } };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hmacSha256(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) =>
    console.log(`[verify-style-purchase][${requestId}] ${msg}`, data ?? '');

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
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      style_id,
      seller_id = null,
    } = body as {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
      style_id: string;
      seller_id?: string | null;
    };

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !style_id) {
      return new Response(
        JSON.stringify({ error: 'razorpay_payment_id, razorpay_order_id, razorpay_signature, style_id are required', code: 'VALIDATION_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 3. Verify Razorpay HMAC ──────────────────────────────────────────────
    const secret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!secret) {
      return new Response(
        JSON.stringify({ error: 'Payment service not configured', code: 'CONFIG_ERROR' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expected = await hmacSha256(secret, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (expected !== razorpay_signature) {
      log('Signature mismatch', { order_id: razorpay_order_id });
      return new Response(
        JSON.stringify({ error: 'Invalid payment signature', code: 'INVALID_SIGNATURE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log('Signature verified ✓');

    // ── 4. Verify order belongs to this user ─────────────────────────────────
    const { data: pendingPurchase } = await adminClient
      .from('style_purchases')
      .select('id, user_id, purchase_amount, currency')
      .eq('order_id', razorpay_order_id)
      .maybeSingle();

    if (pendingPurchase && pendingPurchase.user_id !== user.id) {
      log('Order ownership mismatch', { expected: user.id, actual: pendingPurchase.user_id });
      return new Response(
        JSON.stringify({ error: 'Forbidden', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 5. Get style price (server-side) ─────────────────────────────────────
    const { data: style } = await adminClient
      .from('styles')
      .select('price')
      .eq('id', style_id)
      .single();

    // ── 6. Atomic insert via Postgres function (idempotent) ──────────────────
    const { data: result, error: purchaseError } = await adminClient.rpc(
      'add_style_purchase',
      {
        p_user_id: user.id,
        p_seller_id: seller_id,
        p_style_id: style_id,
        p_amount: style?.price ?? pendingPurchase?.purchase_amount ?? 0,
        p_currency: pendingPurchase?.currency ?? 'INR',
        p_payment_id: razorpay_payment_id,
        p_order_id: razorpay_order_id,
      }
    );

    if (purchaseError) {
      log('add_style_purchase error', purchaseError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to record purchase', code: 'DB_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log('Purchase recorded', result);

    return new Response(
      JSON.stringify({
        success: true,
        purchase_id: result?.purchase_id,
        already_purchased: result?.already_purchased ?? false,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[verify-style-purchase][${requestId}] Unhandled:`, msg);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
