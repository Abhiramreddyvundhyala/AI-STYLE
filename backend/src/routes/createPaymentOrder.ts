/**
 * create-payment-order route
 * Port of supabase/functions/create-payment-order/index.ts → Express
 *
 * POST /create-payment-order
 * Auth required. Creates a Razorpay order for credit purchase.
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { adminClient } from '../lib/supabase';
import { checkRateLimit, RATE_LIMITS, sendRateLimitResponse } from '../lib/rateLimiter';

const router = Router();

router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const requestId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) =>
    console.log(`[create-payment-order][${requestId}] ${msg}`, data ?? '');

  try {
    // ── Rate limit ────────────────────────────────────────────────────────
    const rateLimit = await checkRateLimit(adminClient, user.id, 'create-order', RATE_LIMITS['create-order']);
    if (!rateLimit.allowed) { sendRateLimitResponse(res, rateLimit.resetAt); return; }

    const { package_id, currency = 'INR' } = req.body as { package_id?: string; currency?: string };
    void currency; // INR is always charged

    if (!package_id || typeof package_id !== 'string') {
      res.status(400).json({ error: 'package_id is required', code: 'VALIDATION_ERROR' });
      return;
    }

    // ── Fetch package server-side — never trust frontend for price ────────
    const { data: pkg, error: pkgError } = await adminClient
      .from('packages')
      .select('id, name, credits, price_inr, price_usd, is_active')
      .eq('id', package_id)
      .eq('is_active', true)
      .single();

    if (pkgError || !pkg) {
      log('Package not found', { package_id, error: pkgError?.message });
      res.status(404).json({ error: 'Package not found or inactive', code: 'PACKAGE_NOT_FOUND' });
      return;
    }

    const amountInr: number = pkg.price_inr;
    const amountInPaise = Math.round(amountInr * 100);
    log('Package found', { name: pkg.name, credits: pkg.credits, price_inr: amountInr });

    // ── Create Razorpay order ─────────────────────────────────────────────
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      log('ERROR: Razorpay credentials not configured');
      res.status(503).json({ error: 'Payment service not configured', code: 'CONFIG_ERROR' });
      return;
    }

    const razorpayAuth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');

    const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${razorpayAuth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `credits_${user.id.slice(0, 8)}_${Date.now()}`,
        notes: { user_id: user.id, package_id: pkg.id, package_name: pkg.name, credits: pkg.credits },
      }),
    });

    if (!rzpResponse.ok) {
      const rzpError = await rzpResponse.json() as { error?: { description?: string } };
      log('Razorpay order creation failed', rzpError);
      res.status(502).json({ error: 'Failed to create payment order', code: 'RAZORPAY_ERROR', detail: rzpError?.error?.description });
      return;
    }

    const order = await rzpResponse.json() as { id: string };
    log('Razorpay order created', { order_id: order.id });

    // ── Insert transaction record ─────────────────────────────────────────
    const { error: txnError } = await adminClient.from('transactions').insert({
      user_id: user.id,
      package_id: pkg.id,
      package_name_snapshot: pkg.name,
      credits_added_snapshot: pkg.credits,
      amount: amountInr,
      currency: 'INR',
      payment_gateway: 'razorpay',
      order_id: order.id,
      status: 'created',
    });

    if (txnError) {
      log('ERROR: Failed to insert transaction', txnError.message);
      console.error(`[create-payment-order] DB insert failed for order ${order.id}:`, txnError.message);
    }

    res.status(200).json({
      order_id: order.id,
      amount: amountInPaise,
      amount_inr: amountInr,
      currency: 'INR',
      package_name: pkg.name,
      credits: pkg.credits,
      razorpay_key_id: razorpayKeyId,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[create-payment-order][${requestId}] Unhandled error:`, message);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

export default router;
