/**
 * useAI — thin wrapper around the generate-universal job queue.
 * Starts a generation job, returns jobId. UI polls via useAIGeneration.
 */
import { useMutation } from '@tanstack/react-query';
import { aiService } from '../lib/services/ai.service';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function useAI() {
  const { user } = useAuth();

  const hdMutation = useMutation({
    mutationFn: async ({
      styleId,
      userImageUrl,
      purchaseId,
    }: {
      styleId: string;
      userImageUrl?: string;
      purchaseId: string;
    }) => {
      if (!user) throw new Error('Please sign in');
      return aiService.generateHD(styleId, userImageUrl, user.id, purchaseId);
    },
    onSuccess: () => toast.success('HD image generated'),
    onError: (error: any) => toast.error(error.message || 'HD generation failed'),
  });

  const generateHD = (styleId: string, userImageUrl: string | undefined, purchaseId: string) => {
    if (!user) { toast.error('Please sign in'); return; }
    return hdMutation.mutateAsync({ styleId, userImageUrl, purchaseId });
  };

  return {
    generateHD,
    isGeneratingHD: hdMutation.isPending,
  };
}
