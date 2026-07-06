/**
 * AI Service
 * Thin wrapper around the generate-universal edge function job queue.
 * All generation — face swap, text change, or style recreation — routes
 * through a single endpoint. Prompts are built server-side.
 */

import { supabase } from '../supabase';

export interface GenerationRequest {
  modelId: string;
  styleId: string;
  userImageUrl?: string;
  textModifications?: string;
  width?: number;
  height?: number;
}

export interface GenerationJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  imageUrl?: string;
  error?: string;
}

class AIService {
  /**
   * Start a generation job. Returns a jobId immediately.
   * Poll getJobStatus() until status is 'completed' or 'failed'.
   */
  async startGeneration(request: GenerationRequest): Promise<string> {
    const { data, error } = await supabase.functions.invoke('generate-universal', {
      body: {
        modelId: request.modelId,
        styleId: request.styleId,
        userImageUrl: request.userImageUrl,
        textModifications: request.textModifications,
        width: request.width,
        height: request.height,
      },
    });

    if (error) throw new Error(error.message || 'Failed to start generation');
    if (!data?.jobId) throw new Error('No job ID returned from generation service');

    return data.jobId as string;
  }

  /**
   * Poll the status of a generation job.
   */
  async getJobStatus(jobId: string): Promise<GenerationJob> {
    const { data, error } = await supabase.functions.invoke('get-job-status', {
      body: { jobId },
    });

    if (error) throw new Error(error.message || 'Failed to get job status');

    return {
      jobId: data.jobId,
      status: data.status,
      imageUrl: data.imageUrl,
      error: data.error,
    };
  }

  /**
   * Request HD generation after a verified purchase.
   */
  async generateHD(
    styleId: string,
    userImageUrl: string | undefined,
    userId: string,
    purchaseId: string
  ): Promise<string> {
    const { data, error } = await supabase.functions.invoke('generate-hd', {
      body: { styleId, userImageUrl, userId, purchaseId },
    });

    if (error) throw new Error(error.message || 'HD generation failed');
    return data.hdUrl as string;
  }
}

export const aiService = new AIService();
export default aiService;
