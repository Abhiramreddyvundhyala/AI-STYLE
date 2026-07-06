/**
 * Purchases Hook
 * React hook for managing purchases
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchasesApi } from '../lib/api';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function usePurchases() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get user's purchases
  const {
    data: purchases,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['purchases', user?.id],
    queryFn: () => purchasesApi.getByUser(user!.id),
    enabled: !!user,
  });

  // Check if user has purchased a style
  const checkPurchase = async (styleId: string) => {
    if (!user) return false;
    return purchasesApi.hasPurchased(user.id, styleId);
  };

  return {
    purchases,
    isLoading,
    error,
    checkPurchase,
  };
}

export function useSellerPurchases(sellerId?: string) {
  const { data: purchases, isLoading, error } = useQuery({
    queryKey: ['seller-purchases', sellerId],
    queryFn: () => purchasesApi.getBySeller(sellerId!),
    enabled: !!sellerId,
  });

  return {
    purchases,
    isLoading,
    error,
  };
}
