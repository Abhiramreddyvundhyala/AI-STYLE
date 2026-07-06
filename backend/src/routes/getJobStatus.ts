/**
 * get-job-status route
 * Port of supabase/functions/get-job-status/index.ts → Express
 *
 * POST /get-job-status
 * Body: { jobId: string }
 * Returns current status of a generation job.
 */
import { Router, Request, Response } from 'express';
import { adminClient } from '../lib/supabase';

const router = Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId } = req.body as { jobId?: string };

    if (!jobId) {
      res.status(400).json({ error: 'Missing jobId' });
      return;
    }

    const { data: job, error } = await adminClient
      .from('generation_jobs')
      .select('id, status, result_url, error, created_at, updated_at')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.status(200).json({
      jobId: job.id,
      status: job.status,       // 'pending' | 'processing' | 'completed' | 'failed'
      imageUrl: job.result_url, // set when status = 'completed'
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
