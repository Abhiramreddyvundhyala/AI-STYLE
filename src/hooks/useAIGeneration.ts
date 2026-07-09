/**
 * AI Generation Hook
 * Thin wrapper: upload photo → start backend job → poll → show result.
 *
 * SECURITY: Credit deduction happens ONLY on the backend (generateUniversal.ts).
 * This hook never touches credits directly. (C8 fix)
 */

import { useState, useCallback } from 'react';
import { aiService } from '../lib/services/ai.service';
import { storageService } from '../lib/services/storage.service';
import { useAuth } from './useAuth';
import { useRefreshCredits } from './useCredits';
import { toast } from 'sonner';

export function useAIGeneration() {
  const { user } = useAuth();
  const refreshCredits = useRefreshCredits();
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [timeLeft, setTimeLeft] = useState(5);

  const startBlurTimer = useCallback(() => {
    let countdown = 5;
    const timer = setInterval(() => {
      countdown -= 1;
      setTimeLeft(countdown);
      if (countdown <= 0) {
        clearInterval(timer);
        setIsBlurred(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const pollJob = async (jobId: string): Promise<string> => {
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const job = await aiService.getJobStatus(jobId);
      if (job.status === 'completed' && job.imageUrl) return job.imageUrl;
      if (job.status === 'failed') throw new Error(job.error || 'Generation failed');
    }
    throw new Error('Generation timed out');
  };

  const generateWithPhoto = async (
    file: File,
    styleId: string,
    modelId = 'gpt-image-2',
    textModifications?: string
  ) => {
    if (!user) { toast.error('Please sign in'); return; }

    try {
      setIsUploading(true);
      toast.info('Uploading your photo...');
      if (!storageService.validateImageFile(file)) throw new Error('Invalid image file');
      if (!storageService.validateFileSize(file)) throw new Error('File size exceeds 10MB');
      const compressed = await storageService.compressImage(file);
      const { url: userImageUrl } = await storageService.uploadUserPhoto(compressed, user.id);
      setIsUploading(false);

      // ── Start generation job ──────────────────────────────────────────────
      // Credit deduction happens SERVER-SIDE inside generate-universal.
      // NEVER call deduct_credit from the frontend (C8 fix).
      setIsGenerating(true);
      toast.info('Generating your styled image...');
      const jobId = await aiService.startGeneration({ modelId, styleId, userImageUrl, textModifications });

      let imageUrl: string;
      try {
        imageUrl = await pollJob(jobId);
      } catch (genError: unknown) {
        // Credit is refunded server-side if generation fails
        refreshCredits();
        throw genError;
      }

      setGeneratedImageUrl(imageUrl);
      setIsBlurred(false);
      setTimeLeft(5);
      startBlurTimer();
      toast.success('Image generated! Preview for 5 seconds...');

      // Refresh credits to show updated balance (server already deducted)
      refreshCredits();

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Generation failed';
      toast.error(msg);
      throw error;
    } finally {
      setIsUploading(false);
      setIsGenerating(false);
    }
  };

  const reset = () => {
    setGeneratedImageUrl('');
    setIsBlurred(false);
    setTimeLeft(5);
  };

  return {
    generateWithPhoto,
    generatedImageUrl,
    isBlurred,
    timeLeft,
    isUploading,
    isGenerating,
    isProcessing: isUploading || isGenerating,
    reset,
  };
}
