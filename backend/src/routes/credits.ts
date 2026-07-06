/**
 * credits routes
 * Ports of:
 *   - supabase/functions/credits-balance/index.ts
 *   - supabase/functions/credits-transactions/index.ts
 *   - supabase/functions/credits-generations/index.ts
 *
 * GET /credits/balance
 * GET /credits/transactions?page=1&page_size=20
 * GET /credits/generations?page=1&page_size=20
 *
 * All routes require auth.
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { adminClient } from '../lib/supabase';

const router = Router();

// ── GET /credits/balance ──────────────────────────────────────────────────────
router.get('/balance', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const requestId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) =>
    console.log(`[credits-balance][${requestId}] ${msg}`, data ?? '');

  try {
    log('Fetching balance for user', user.id);

    const { data: balance, error: balanceError } = await adminClient.rpc('get_user_balance', {
      p_user_id: user.id,
    });

    if (balanceError) {
      log('ERROR: get_user_balance failed', balanceError.message);
      res.status(500).json({ error: 'Failed to fetch balance', code: 'DB_ERROR' });
      return;
    }

    res.status(200).json({
      free_credits_remaining: (balance as Record<string, number>)?.free_credits_remaining ?? 0,
      paid_credits: (balance as Record<string, number>)?.paid_credits ?? 0,
      total_credits: (balance as Record<string, number>)?.total_credits ?? 0,
      last_credit_reset: (balance as Record<string, string>)?.last_credit_reset,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[credits-balance][${requestId}] Unhandled:`, message);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── GET /credits/transactions ─────────────────────────────────────────────────
router.get('/transactions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const requestId = crypto.randomUUID();

  try {
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt((req.query.page_size as string) ?? '20', 10)));
    const offset = (page - 1) * pageSize;

    const { data: transactions, error: txnError, count } = await adminClient
      .from('transactions')
      .select(
        'id, package_name_snapshot, credits_added_snapshot, amount, currency, status, payment_id, order_id, created_at',
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (txnError) {
      console.error(`[credits-transactions][${requestId}] DB error:`, txnError.message);
      res.status(500).json({ error: 'Failed to fetch transactions', code: 'DB_ERROR' });
      return;
    }

    const total = count ?? 0;
    res.status(200).json({ data: transactions ?? [], total, page, page_size: pageSize, has_more: offset + pageSize < total });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[credits-transactions][${requestId}] Unhandled:`, message);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── GET /credits/generations ──────────────────────────────────────────────────
router.get('/generations', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const requestId = crypto.randomUUID();

  try {
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt((req.query.page_size as string) ?? '20', 10)));
    const offset = (page - 1) * pageSize;

    const { data: generations, error: genError, count } = await adminClient
      .from('generation_history')
      .select(
        `id, prompt, image_url, credit_type, credits_used, status, created_at, style_id,
         styles ( id, title, category )`,
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (genError) {
      console.error(`[credits-generations][${requestId}] DB error:`, genError.message);
      res.status(500).json({ error: 'Failed to fetch generation history', code: 'DB_ERROR' });
      return;
    }

    const total = count ?? 0;
    res.status(200).json({ data: generations ?? [], total, page, page_size: pageSize, has_more: offset + pageSize < total });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[credits-generations][${requestId}] Unhandled:`, message);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

export default router;
