/**
 * admin-config route
 * Port of supabase/functions/admin-config/index.ts → Express
 *
 * GET  /admin-config   → Get all config values (admin only)
 * PUT  /admin-config   → Update config values (admin only)
 *
 * Admin check: user must exist in admin_users table.
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { adminClient } from '../lib/supabase';

const router = Router();

const ALLOWED_CONFIG_KEYS = ['free_generations_per_month', 'credits_per_generation'];

/** Verify the authenticated user is in admin_users */
async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await adminClient
    .from('admin_users')
    .select('id')
    .eq('id', userId)
    .single();
  return !!data;
}

// ── GET /admin-config ─────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const requestId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) =>
    console.log(`[admin-config][${requestId}] ${msg}`, data ?? '');

  try {
    if (!(await isAdmin(user.id))) {
      res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
      return;
    }

    const { data: config, error } = await adminClient
      .from('admin_config')
      .select('key, value, updated_at')
      .in('key', ALLOWED_CONFIG_KEYS);

    if (error) {
      res.status(500).json({ error: 'Failed to fetch config', code: 'DB_ERROR' });
      return;
    }

    const configMap = (config ?? []).reduce((acc: Record<string, string>, row) => {
      acc[row.key as string] = row.value as string;
      return acc;
    }, {});

    log('Config fetched', configMap);
    res.status(200).json({ data: configMap, raw: config });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[admin-config][${requestId}] Unhandled:`, message);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── PUT /admin-config ─────────────────────────────────────────────────────────
router.put('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const requestId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) =>
    console.log(`[admin-config][${requestId}] ${msg}`, data ?? '');

  try {
    if (!(await isAdmin(user.id))) {
      res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
      return;
    }

    const body = req.body as Record<string, unknown>;

    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_CONFIG_KEYS.includes(key)) {
        res.status(400).json({
          error: `Unknown config key: ${key}. Allowed: ${ALLOWED_CONFIG_KEYS.join(', ')}`,
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const numVal = parseInt(String(value), 10);
      if (isNaN(numVal) || numVal < 1) {
        res.status(400).json({ error: `${key} must be a positive integer`, code: 'VALIDATION_ERROR' });
        return;
      }

      const { error: upsertError } = await adminClient
        .from('admin_config')
        .upsert({ key, value: String(numVal), updated_at: new Date().toISOString() }, { onConflict: 'key' });

      if (upsertError) {
        res.status(500).json({ error: `Failed to update ${key}`, code: 'DB_ERROR' });
        return;
      }

      log('Config updated', { key, value: numVal });
    }

    // Return updated config
    const { data: config } = await adminClient
      .from('admin_config')
      .select('key, value, updated_at')
      .in('key', ALLOWED_CONFIG_KEYS);

    const configMap = (config ?? []).reduce((acc: Record<string, string>, row) => {
      acc[row.key as string] = row.value as string;
      return acc;
    }, {});

    res.status(200).json({ data: configMap, message: 'Config updated successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[admin-config][${requestId}] Unhandled:`, message);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

export default router;
