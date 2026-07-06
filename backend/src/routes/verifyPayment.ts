/**
 * verify-payment route
 * Port of supabase/functions/verify-payment/index.ts → Express
 *
 * POST /verify-payment
 * Auth required. Verifies Razorpay HMAC and atomically adds credits.
 */
import { Router, Request, Response } from 'express';
import { createHmac } from 'crypto';
import { requireAuth } from '../middleware/auth';
import { adminClient } from '../lib/supabase';
import { checkRateLimit, RATE_LIMITS, sendRateLimitResponse } from '../lib/rateLimiter';

const router = Router();

function computeHmacSha256(key: string, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}

router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const requestId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) =>
    console.log(`[verify-payment][${requestId}] ${msg}`, data ?? '');

  try {
    // ── Rate limit ────────────────────────────────────────────────────────
    const rateLimit = await checkRateLimit(adminClient, user.id, 'verify-payment', RATE_LIMITS['verify-payment']);
    if (!rateLimit.allowed) { sendRateLimitResponse(res, rateLimit.resetAt); return; }

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body as {
      razorpay_payment_id?: string;
      razorpay_order_id?: string;
      razorpay_signature?: string;
    };

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      res.status(400).json({ error: 'razorpay_payment_id, razorpay_order_id, and razorpay_signature are required', code: 'VALIDATION_ERROR' });
      return;
    }

    // ── Verify HMAC signature ─────────────────────────────────────────────
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      log('ERROR: RAZORPAY_KEY_SECRET not set');
      res.status(503).json({ error: 'Payment service not configured', code: 'CONFIG_ERROR' });
      return;
    }

    const expectedSignature = computeHmacSha256(secret, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (expectedSignature !== razorpay_signature) {
      log('Signature verification FAILED', { user: user.id, order_id: razorpay_order_id });
      res.status(400).json({ error: 'Invalid payment signature', code: 'INVALID_SIGNATURE' });
      return;
    }
    log('Signature verified ✓', { order_id: razorpay_order_id });

    // ── Verify transaction belongs to this user ───────────────────────────
    const { data: txn } = await adminClient
      .from('transactions')
      .select('id, user_id, status, credits_added_snapshot')
      .eq('order_id', razorpay_order_id)
      .single();

    if (txn && txn.user_id !== user.id) {
      log('ERROR: Transaction user_id mismatch', { expected: user.id, actual: txn.user_id });
      res.status(403).json({ error: 'Transaction does not belong to this user', code: 'FORBIDDEN' });
      return;
    }

    // ── Atomically add credits (idempotent) ───────────────────────────────
    const { data: result, error: creditError } = await adminClient.rpc('add_credits_after_payment', {
      p_payment_id: razorpay_payment_id,
      p_order_id: razorpay_order_id,
    });

    if (creditError) {
      log('ERROR: add_credits_after_payment failed', creditError.message);
      if (creditError.message?.includes('TRANSACTION_NOT_FOUND')) {
        res.status(404).json({ error: 'Transaction not found', code: 'TRANSACTION_NOT_FOUND' });
        return;
      }
      res.status(500).json({ error: 'Failed to process payment', code: 'DB_ERROR' });
      return;
    }

    const alreadyCaptured = (result as { already_captured?: boolean })?.already_captured ?? false;
    const creditsAdded = (result as { credits_added?: number })?.credits_added ?? 0;
    log('Credits processed', { already_captured: alreadyCaptured, credits_added: creditsAdded, user: user.id });

    res.status(200).json({
      success: true,
      already_captured: alreadyCaptured,
      credits_added: creditsAdded,
      free_credits_remaining: (result as Record<string, number>)?.free_credits_remaining ?? 0,
      paid_credits: (result as Record<string, number>)?.paid_credits ?? 0,
      total_credits: ((result as Record<string, number>)?.free_credits_remaining ?? 0) + ((result as Record<string, number>)?.paid_credits ?? 0),
      message: alreadyCaptured ? 'Payment already processed' : `${creditsAdded} credits added to your account!`,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[verify-payment][${requestId}] Unhandled error:`, message);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

export default router;
