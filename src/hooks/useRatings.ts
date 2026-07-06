/**
 * Ratings Hook
 * React hook for managing ratings and reviews
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ratingsApi } from '../lib/api';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { CreateRatingInput } from '../lib/types/database';

export function useRatings(styleId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get all ratings for a style
  const {
    data: ratings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ratings', styleId],
    queryFn: () => ratingsApi.getByStyle(styleId),
  });

  // Get user's rating for this style
  const { data: userRating } = useQuery({
    queryKey: ['user-rating', styleId, user?.id],
    queryFn: () => ratingsApi.getUserRating(user!.id, styleId),
    enabled: !!user,
  });

  // Create or update rating
  const rateMutation = useMutation({
    mutationFn: (input: CreateRatingInput) => ratingsApi.upsert(input),
    onSuccess: () => {
      toast.success('Rating submitted successfully');
      queryClient.invalidateQueries({ queryKey: ['ratings', styleId] });
      queryClient.invalidateQueries({ queryKey: ['user-rating', styleId] });
      queryClient.invalidateQueries({ queryKey: ['styles'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to submit rating');
    },
  });

  // Delete rating
  const deleteMutation = useMutation({
    mutationFn: () => ratingsApi.delete(user!.id, styleId),
    onSuccess: () => {
      toast.success('Rating deleted');
      queryClient.invalidateQueries({ queryKey: ['ratings', styleId] });
      queryClient.invalidateQueries({ queryKey: ['user-rating', styleId] });
      queryClient.invalidateQueries({ queryKey: ['styles'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete rating');
    },
  });

  const rateStyle = (stars: number, reviewText?: string) => {
    if (!user) {
      toast.error('Please sign in to rate');
      return;
    }

    return rateMutation.mutateAsync({
      buyer_id: user.id,
      style_id: styleId,
      stars,
      review_text: reviewText,
    });
  };

  const deleteRating = () => {
    if (!user) return;
    return deleteMutation.mutateAsync();
  };

  return {
    ratings,
    userRating,
    isLoading,
    error,
    rateStyle,
    deleteRating,
    isRating: rateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
