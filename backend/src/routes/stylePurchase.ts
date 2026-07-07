/**
 * style-purchase route
 * Port of supabase/functions/style-purchase/index.ts → Express
 *
 * POST /style-purchase
 * Auth required. Creates Razorpay order for a style download purchase.
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { adminClient } from '../lib/supabase';

const router = Router();

router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const requestId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) =>
    console.log(`[style-purchase][${requestId}] ${msg}`, data ?? '');

  try {
    const { style_id, currency = 'INR' } = req.body as { style_id?: string; currency?: string };

    if (!style_id) {
      res.status(400).json({ error: 'style_id is required', code: 'VALIDATION_ERROR' });
      return;
    }

    // ── Fetch style price server-side ─────────────────────────────────────
    const { data: style, error: styleError } = await adminClient
      .from('styles')
      .select('id, title, price, seller_id')
      .eq('id', style_id)
      .single();

    if (styleError || !style) {
      res.status(404).json({ error: 'Style not found', code: 'NOT_FOUND' });
      return;
    }

    log('Style fetched', { id: style.id, price: style.price });

    // ── Check if already purchased ────────────────────────────────────────
    const { data: existing } = await adminClient
      .from('style_purchases')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('style_id', style_id)
      .eq('status', 'completed')
      .maybeSingle();

    if (existing) {
      log('Already purchased', existing.id);
      res.status(200).json({ already_purchased: true, purchase_id: existing.id });
      return;
    }

    // ── Free style: auto-grant ────────────────────────────────────────────
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
      res.status(200).json({ already_purchased: true, purchase_id: freePurchase?.id ?? null });
      return;
    }

    // ── Paid style: create Razorpay order ─────────────────────────────────
    // .trim() guards against accidental whitespace/newlines in env var values
    const razorpayKeyId = (process.env.RAZORPAY_KEY_ID ?? '').trim();
    const razorpayKeySecret = (process.env.RAZORPAY_KEY_SECRET ?? '').trim();

    if (!razorpayKeyId || !razorpayKeySecret) {
      log('ERROR: Razorpay keys not configured');
      res.status(503).json({ error: 'Payment service not configured', code: 'CONFIG_ERROR' });
      return;
    }

    log('Razorpay credentials check', {
      key_id_prefix: razorpayKeyId.slice(0, 12) + '...',
      key_id_length: razorpayKeyId.length,
      secret_length: razorpayKeySecret.length,
      mode: razorpayKeyId.startsWith('rzp_live_') ? 'LIVE' : 'TEST',
    });
    const amountPaise = Math.round((style.price as number) * 100);
    const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency,
        receipt: `sp_${style_id.slice(0, 8)}_${Date.now()}`,
        notes: { user_id: user.id, style_id: style.id, type: 'style_purchase' },
      }),
    });

    if (!rzpResponse.ok) {
      const errText = await rzpResponse.text();
      log('Razorpay order creation failed', errText);
      res.status(502).json({ error: 'Payment service unavailable', code: 'RAZORPAY_ERROR' });
      return;
    }

    const rzpOrder = await rzpResponse.json() as { id: string };
    log('Razorpay order created', rzpOrder.id);

    // ── Record pending purchase ───────────────────────────────────────────
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

    res.status(200).json({
      order_id: rzpOrder.id,
      razorpay_key_id: razorpayKeyId,
      amount: amountPaise,
      currency,
      style_title: style.title,
      style_price: style.price,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[style-purchase][${requestId}] Unhandled:`, msg);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

export default router;
