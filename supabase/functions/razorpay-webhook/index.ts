/**
 * Razorpay Webhook Handler — Supabase Edge Function
 *
 * POST /functions/v1/razorpay-webhook
 *
 * Handles:
 *   - payment.captured  → Fallback credit add (if verify-payment was missed)
 *   - refund.processed  → Reverse credits atomically
 *
 * Security:
 * - Webhook signature verified using RAZORPAY_WEBHOOK_SECRET (different from API secret)
 * - Raw body read before JSON parsing (required for HMAC)
 * - Idempotent: credits only added once per payment_id
 * - No auth header required (Razorpay calls this directly)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
};

/**
 * Compute HMAC-SHA256 using Web Crypto API
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
    console.log(`[razorpay-webhook][${requestId}] ${msg}`, data ?? '');

  // ── Read raw body first (before JSON.parse) — required for HMAC ──────────
  const rawBody = await req.text();

  try {
    // ── 1. Verify webhook signature ─────────────────────────────────────────
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) {
      log('ERROR: RAZORPAY_WEBHOOK_SECRET not set');
      return new Response('Webhook secret not configured', { status: 503 });
    }

    const receivedSignature = req.headers.get('x-razorpay-signature');
    if (!receivedSignature) {
      log('ERROR: Missing x-razorpay-signature header');
      return new Response('Missing signature', { status: 400 });
    }

    const expectedSignature = await computeHmacSha256(webhookSecret, rawBody);

    if (expectedSignature !== receivedSignature) {
      log('Webhook signature INVALID');
      return new Response('Invalid signature', { status: 400 });
    }

    log('Webhook signature verified ✓');

    // ── 2. Parse event ──────────────────────────────────────────────────────
    const event = JSON.parse(rawBody);
    const eventType: string = event.event;
    const payload = event.payload;

    log('Webhook event received', { event: eventType });

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── 3. Handle payment.captured ──────────────────────────────────────────
    if (eventType === 'payment.captured') {
      const payment = payload?.payment?.entity;
      if (!payment) {
        log('ERROR: No payment entity in payload');
        return new Response('Invalid payload', { status: 400 });
      }

      const paymentId: string = payment.id;
      const orderId: string = payment.order_id;

      log('Processing payment.captured', { payment_id: paymentId, order_id: orderId });

      // Atomically add credits (idempotent via Postgres function)
      const { data: result, error: creditError } = await adminClient.rpc(
        'add_credits_after_payment',
        {
          p_payment_id: paymentId,
          p_order_id: orderId,
        }
      );

      if (creditError) {
        if (creditError.message?.includes('TRANSACTION_NOT_FOUND')) {
          // Possible race with verify-payment, or order created outside normal flow
          log('WARNING: Transaction not found for webhook', { order_id: orderId });
          // Return 200 so Razorpay doesn't retry endlessly
          return new Response(JSON.stringify({ received: true, warning: 'transaction_not_found' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        log('ERROR: add_credits_after_payment failed', creditError.message);
        return new Response('Failed to process webhook', { status: 500 });
      }

      const alreadyCaptured = result?.already_captured ?? false;
      log('payment.captured handled', {
        already_captured: alreadyCaptured,
        credits_added: result?.credits_added,
      });

      return new Response(
        JSON.stringify({ received: true, already_captured: alreadyCaptured }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── 4. Handle refund.processed ──────────────────────────────────────────
    if (eventType === 'refund.processed') {
      const refund = payload?.refund?.entity;
      if (!refund) {
        log('ERROR: No refund entity in payload');
        return new Response('Invalid payload', { status: 400 });
      }

      const paymentId: string = refund.payment_id;

      log('Processing refund.processed', { payment_id: paymentId });

      // Atomically reverse credits
      const { error: refundError } = await adminClient.rpc('reverse_credits_for_refund', {
        p_payment_id: paymentId,
      });

      if (refundError) {
        log('ERROR: reverse_credits_for_refund failed', refundError.message);
        return new Response('Failed to process refund', { status: 500 });
      }

      log('refund.processed handled', { payment_id: paymentId });

      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── 5. Unhandled event type — acknowledge receipt ───────────────────────
    log('Unhandled event type', { event: eventType });
    return new Response(
      JSON.stringify({ received: true, event: eventType, status: 'unhandled' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[razorpay-webhook][${requestId}] Unhandled error:`, message);
    return new Response('Internal server error', { status: 500 });
  }
});
