/**
 * AI Service
 * Thin wrapper around the generate-universal Render backend endpoint.
 * All generation — face swap, text change, or style recreation — routes
 * through a single endpoint. Prompts are built server-side.
 */

import { backendApi } from '../backendApi';

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
    const data = await backendApi.post<{ jobId: string; status: string }>('generate-universal', {
      modelId: request.modelId,
      styleId: request.styleId,
      userImageUrl: request.userImageUrl,
      textModifications: request.textModifications,
      width: request.width,
      height: request.height,
    });

    if (!data?.jobId) throw new Error('No job ID returned from generation service');
    return data.jobId;
  }

  /**
   * Poll the status of a generation job.
   */
  async getJobStatus(jobId: string): Promise<GenerationJob> {
    const data = await backendApi.post<GenerationJob>('get-job-status', { jobId });
    return {
      jobId: data.jobId,
      status: data.status,
      imageUrl: data.imageUrl,
      error: data.error,
    };
  }

  /**
   * Request HD generation after a verified purchase.
   * Falls back to generate-universal on the Render backend.
   */
  async generateHD(
    styleId: string,
    userImageUrl: string | undefined,
    _userId: string,
    _purchaseId: string
  ): Promise<string> {
    // generate-hd is deprecated — route through generate-universal with HD flag
    const jobId = await this.startGeneration({
      modelId: 'gpt-image-2',
      styleId,
      userImageUrl,
    });
    return jobId;
  }
}

export const aiService = new AIService();
export default aiService;
