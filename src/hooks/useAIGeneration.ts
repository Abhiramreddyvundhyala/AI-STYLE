/**
 * AI Generation Hook
 * Manages the complete generate-universal job queue flow:
 * upload photo → deduct credit → start job → poll status → log history → show result
 */

import { useState, useCallback } from 'react';
import { aiService } from '../lib/services/ai.service';
import { storageService } from '../lib/services/storage.service';
import { useAuth } from './useAuth';
import { useRefreshCredits } from './useCredits';
import { supabase } from '@/lib/supabase';
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

    let creditType: string | null = null;

    try {
      setIsUploading(true);
      toast.info('Uploading your photo...');
      if (!storageService.validateImageFile(file)) throw new Error('Invalid image file');
      if (!storageService.validateFileSize(file)) throw new Error('File size exceeds 10MB');
      const compressed = await storageService.compressImage(file);
      const { url: userImageUrl } = await storageService.uploadUserPhoto(compressed, user.id);
      setIsUploading(false);

      // ── Deduct a credit BEFORE generation ────────────────────────────────
      // deduct_credit: returns 'free' or 'paid', or throws if no credits left
      const { data: deductedType, error: creditError } = await supabase.rpc('deduct_credit', {
        p_user_id: user.id,
      });

      if (creditError) {
        const msg = creditError.message ?? '';
        if (msg.includes('INSUFFICIENT_CREDITS')) {
          throw new Error('You have no credits left. Buy credits to continue generating.');
        }
        // If function not found (migration not run), show a helpful message
        if (creditError.code === 'PGRST202' || creditError.code === '42883') {
          console.warn('[useAIGeneration] deduct_credit RPC not available — run the SQL migration');
          // Allow generation to proceed without deduction (graceful degradation)
        } else {
          throw new Error(creditError.message);
        }
      } else {
        creditType = deductedType as string; // 'free' | 'paid'
      }

      // Refresh balance badge in Navbar immediately
      refreshCredits();

      // ── Start generation job ──────────────────────────────────────────────
      setIsGenerating(true);
      toast.info('Generating your styled image...');
      const jobId = await aiService.startGeneration({ modelId, styleId, userImageUrl, textModifications });

      let imageUrl: string;
      try {
        imageUrl = await pollJob(jobId);
      } catch (genError: unknown) {
        // Refund credit if generation failed
        if (creditType) {
          await supabase.rpc('refund_credit', {
            p_user_id: user.id,
            p_credit_type: creditType,
          }).then(({ error }) => {
            if (error) console.warn('Credit refund failed:', error.message);
          });
          refreshCredits();
        }
        throw genError;
      }

      setGeneratedImageUrl(imageUrl);
      setIsBlurred(false);
      setTimeLeft(5);
      startBlurTimer();
      toast.success('Image generated! Preview for 5 seconds...');

      // ── Log to generation_history (best-effort, non-blocking) ────────────
      supabase.from('generation_history').insert({
        user_id: user.id,
        style_id: styleId,
        image_url: imageUrl,
        credit_type: creditType ?? 'free',
        credits_used: 1,
        status: 'success',
        metadata: { model_id: modelId, has_text_modification: !!textModifications },
      }).then(({ error }) => {
        if (error && error.code !== '42P01') {
          console.warn('[useAIGeneration] generation_history insert failed:', error.message);
        }
      });

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
