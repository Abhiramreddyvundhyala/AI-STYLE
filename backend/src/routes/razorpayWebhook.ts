/**
 * razorpay-webhook route
 * Port of supabase/functions/razorpay-webhook/index.ts → Express
 *
 * POST /razorpay-webhook
 * NO auth header — Razorpay calls this directly.
 * Verified via HMAC-SHA256 using RAZORPAY_WEBHOOK_SECRET.
 *
 * IMPORTANT: This route must use express.raw() body parser (not JSON)
 * so the raw body is preserved for HMAC verification.
 */
import { Router, Request, Response } from 'express';
import { createHmac } from 'crypto';
import { adminClient } from '../lib/supabase';

const router = Router();

function computeHmac(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

// NOTE: This route gets the raw Buffer body from the parent app's
// express.raw({ type: 'application/json' }) applied specifically for this path.
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const requestId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) =>
    console.log(`[razorpay-webhook][${requestId}] ${msg}`, data ?? '');

  // Raw body is set by express.raw() middleware in index.ts for this path
  const rawBody: string = (req as Request & { rawBody?: string }).rawBody ?? '';

  try {
    // ── 1. Verify webhook signature ───────────────────────────────────────
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      log('ERROR: RAZORPAY_WEBHOOK_SECRET not set');
      res.status(503).send('Webhook secret not configured');
      return;
    }

    const receivedSignature = req.headers['x-razorpay-signature'] as string | undefined;
    if (!receivedSignature) {
      log('ERROR: Missing x-razorpay-signature header');
      res.status(400).send('Missing signature');
      return;
    }

    const expectedSignature = computeHmac(webhookSecret, rawBody);
    if (expectedSignature !== receivedSignature) {
      log('Webhook signature INVALID');
      res.status(400).send('Invalid signature');
      return;
    }
    log('Webhook signature verified ✓');

    // ── 2. Parse event ────────────────────────────────────────────────────
    const event = JSON.parse(rawBody) as {
      event: string;
      payload: {
        payment?: { entity: { id: string; order_id: string } };
        refund?: { entity: { payment_id: string } };
      };
    };
    const eventType = event.event;
    const payload = event.payload;
    log('Webhook event received', { event: eventType });

    // ── 3. Handle payment.captured ────────────────────────────────────────
    if (eventType === 'payment.captured') {
      const payment = payload?.payment?.entity;
      if (!payment) { log('ERROR: No payment entity'); res.status(400).send('Invalid payload'); return; }

      const paymentId = payment.id;
      const orderId = payment.order_id;
      log('Processing payment.captured', { payment_id: paymentId, order_id: orderId });

      const { data: result, error: creditError } = await adminClient.rpc('add_credits_after_payment', {
        p_payment_id: paymentId,
        p_order_id: orderId,
      });

      if (creditError) {
        if (creditError.message?.includes('TRANSACTION_NOT_FOUND')) {
          log('WARNING: Transaction not found for webhook', { order_id: orderId });
          res.status(200).json({ received: true, warning: 'transaction_not_found' });
          return;
        }
        log('ERROR: add_credits_after_payment failed', creditError.message);
        res.status(500).send('Failed to process webhook');
        return;
      }

      const alreadyCaptured = (result as { already_captured?: boolean })?.already_captured ?? false;
      log('payment.captured handled', { already_captured: alreadyCaptured });
      res.status(200).json({ received: true, already_captured: alreadyCaptured });
      return;
    }

    // ── 4. Handle refund.processed ────────────────────────────────────────
    if (eventType === 'refund.processed') {
      const refund = payload?.refund?.entity;
      if (!refund) { log('ERROR: No refund entity'); res.status(400).send('Invalid payload'); return; }

      const paymentId = refund.payment_id;
      log('Processing refund.processed', { payment_id: paymentId });

      const { error: refundError } = await adminClient.rpc('reverse_credits_for_refund', { p_payment_id: paymentId });
      if (refundError) {
        log('ERROR: reverse_credits_for_refund failed', refundError.message);
        res.status(500).send('Failed to process refund');
        return;
      }

      log('refund.processed handled', { payment_id: paymentId });
      res.status(200).json({ received: true });
      return;
    }

    // ── 5. Unhandled event — acknowledge ──────────────────────────────────
    log('Unhandled event type', { event: eventType });
    res.status(200).json({ received: true, event: eventType, status: 'unhandled' });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[razorpay-webhook][${requestId}] Unhandled error:`, message);
    res.status(500).send('Internal server error');
  }
});

export default router;
