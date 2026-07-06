/**
 * Seller Hook
 * React hook for seller operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sellersApi, withdrawalsApi } from '../lib/api';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { Seller, CreateWithdrawalInput } from '../lib/types/database';

export function useSeller() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get seller profile
  const {
    data: seller,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['seller', user?.id],
    queryFn: () => sellersApi.getProfile(user!.id),
    enabled: !!user,
  });

  // Get seller stats
  const { data: stats } = useQuery({
    queryKey: ['seller-stats', user?.id],
    queryFn: () => sellersApi.getStats(user!.id),
    enabled: !!user,
  });

  // Create seller profile
  const createMutation = useMutation({
    mutationFn: (input: { display_name: string; upi_id?: string }) =>
      sellersApi.create({ id: user!.id, ...input }),
    onSuccess: () => {
      toast.success('Seller profile created');
      queryClient.invalidateQueries({ queryKey: ['seller'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create seller profile');
    },
  });

  // Update seller profile
  const updateMutation = useMutation({
    mutationFn: (input: Partial<Seller>) =>
      sellersApi.update(user!.id, input),
    onSuccess: () => {
      toast.success('Profile updated');
      queryClient.invalidateQueries({ queryKey: ['seller'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });

  const createProfile = (displayName: string, upiId?: string) => {
    return createMutation.mutateAsync({
      display_name: displayName,
      upi_id: upiId,
    });
  };

  const updateProfile = (updates: Partial<Seller>) => {
    return updateMutation.mutateAsync(updates);
  };

  return {
    seller,
    stats,
    isLoading,
    error,
    createProfile,
    updateProfile,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}

export function useWithdrawals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get withdrawals
  const {
    data: withdrawals,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['withdrawals', user?.id],
    queryFn: () => withdrawalsApi.getBySeller(user!.id),
    enabled: !!user,
  });

  // Request withdrawal
  const withdrawMutation = useMutation({
    mutationFn: (input: CreateWithdrawalInput) =>
      withdrawalsApi.create(input),
    onSuccess: () => {
      toast.success('Withdrawal request submitted');
      queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['seller'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to request withdrawal');
    },
  });

  const requestWithdrawal = (amount: number, upiId: string) => {
    if (!user) {
      toast.error('Please sign in');
      return;
    }

    return withdrawMutation.mutateAsync({
      seller_id: user.id,
      amount,
      upi_id: upiId,
    });
  };

  return {
    withdrawals,
    isLoading,
    error,
    requestWithdrawal,
    isRequesting: withdrawMutation.isPending,
  };
}
