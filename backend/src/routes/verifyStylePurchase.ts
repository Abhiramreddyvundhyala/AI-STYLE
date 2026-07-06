/**
 * verify-style-purchase route
 * Port of supabase/functions/verify-style-purchase/index.ts → Express
 *
 * POST /verify-style-purchase
 * Auth required. Verifies Razorpay HMAC and records a completed style purchase.
 */
import { Router, Request, Response } from 'express';
import { createHmac } from 'crypto';
import { requireAuth } from '../middleware/auth';
import { adminClient } from '../lib/supabase';

const router = Router();

function hmacSha256(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const requestId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) =>
    console.log(`[verify-style-purchase][${requestId}] ${msg}`, data ?? '');

  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      style_id,
      seller_id = null,
    } = req.body as {
      razorpay_payment_id?: string;
      razorpay_order_id?: string;
      razorpay_signature?: string;
      style_id?: string;
      seller_id?: string | null;
    };

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !style_id) {
      res.status(400).json({ error: 'razorpay_payment_id, razorpay_order_id, razorpay_signature, style_id are required', code: 'VALIDATION_ERROR' });
      return;
    }

    // ── Verify HMAC ───────────────────────────────────────────────────────
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      res.status(503).json({ error: 'Payment service not configured', code: 'CONFIG_ERROR' });
      return;
    }

    const expected = hmacSha256(secret, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (expected !== razorpay_signature) {
      log('Signature mismatch', { order_id: razorpay_order_id });
      res.status(400).json({ error: 'Invalid payment signature', code: 'INVALID_SIGNATURE' });
      return;
    }
    log('Signature verified ✓');

    // ── Verify order ownership ────────────────────────────────────────────
    const { data: pendingPurchase } = await adminClient
      .from('style_purchases')
      .select('id, user_id, purchase_amount, currency')
      .eq('order_id', razorpay_order_id)
      .maybeSingle();

    if (pendingPurchase && (pendingPurchase as { user_id: string }).user_id !== user.id) {
      log('Order ownership mismatch');
      res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
      return;
    }

    // ── Get style price server-side ───────────────────────────────────────
    const { data: style } = await adminClient
      .from('styles')
      .select('price')
      .eq('id', style_id)
      .single();

    // ── Atomic insert via Postgres function ───────────────────────────────
    const { data: result, error: purchaseError } = await adminClient.rpc('add_style_purchase', {
      p_user_id: user.id,
      p_seller_id: seller_id,
      p_style_id: style_id,
      p_amount: (style as { price?: number })?.price ?? (pendingPurchase as { purchase_amount?: number })?.purchase_amount ?? 0,
      p_currency: (pendingPurchase as { currency?: string })?.currency ?? 'INR',
      p_payment_id: razorpay_payment_id,
      p_order_id: razorpay_order_id,
    });

    if (purchaseError) {
      log('add_style_purchase error', purchaseError.message);
      res.status(500).json({ error: 'Failed to record purchase', code: 'DB_ERROR' });
      return;
    }

    log('Purchase recorded', result);
    res.status(200).json({
      success: true,
      purchase_id: (result as { purchase_id?: string })?.purchase_id,
      already_purchased: (result as { already_purchased?: boolean })?.already_purchased ?? false,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[verify-style-purchase][${requestId}] Unhandled:`, msg);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

export default router;
