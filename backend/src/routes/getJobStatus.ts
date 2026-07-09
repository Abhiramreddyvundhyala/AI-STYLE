/**
 * get-job-status route
 * Port of supabase/functions/get-job-status/index.ts → Express
 *
 * POST /get-job-status
 * Auth required. Body: { jobId: string }
 * Returns current status of a generation job owned by the authenticated user.
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { adminClient } from '../lib/supabase';
import { checkRateLimit, sendRateLimitResponse } from '../lib/rateLimiter';

const router = Router();

// 60 polls per minute per user (3s polling interval × 20 jobs = plenty)
const JOB_STATUS_RATE_LIMIT = { maxRequests: 60, windowSeconds: 60 };

router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  try {
    // ── Rate limit ─────────────────────────────────────────────────────────
    const rateLimit = await checkRateLimit(adminClient, user.id, 'get-job-status', JOB_STATUS_RATE_LIMIT);
    if (!rateLimit.allowed) { sendRateLimitResponse(res, rateLimit.resetAt); return; }

    const { jobId } = req.body as { jobId?: string };

    if (!jobId || typeof jobId !== 'string' || jobId.length > 100) {
      res.status(400).json({ error: 'Missing or invalid jobId' });
      return;
    }

    const { data: job, error } = await adminClient
      .from('generation_jobs')
      .select('id, status, result_url, error, created_at, updated_at, user_id')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    // ── Ownership check (C2 fix) ───────────────────────────────────────────
    // Prevent IDOR: user can only poll their own jobs
    if (job.user_id && job.user_id !== user.id) {
      res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
      return;
    }

    // ── Never expose raw storage URLs for completed jobs ───────────────────
    // The client will request a signed URL separately if they own this job.
    // For status polling we only reveal the URL to the owner (ownership
    // already verified above). The bucket must also be private (see C3 fix).
    res.status(200).json({
      jobId: job.id,
      status: job.status,       // 'pending' | 'processing' | 'completed' | 'failed'
      imageUrl: job.result_url, // Only returned to verified owner
      error: job.error,         // set when status = 'failed'
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

export default router;
