/**
 * Payment Hook
 * React hook for handling payments
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentService } from '../lib/services/payment.service';
import { purchasesApi } from '../lib/api';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function usePayment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  const purchaseMutation = useMutation({
    mutationFn: async ({
      styleId,
      amount,
    }: {
      styleId: string;
      amount: number;
    }) => {
      if (!user) throw new Error('User not authenticated');

      setIsProcessing(true);

      // Create Razorpay order
      const order = await paymentService.createOrder(styleId, amount);

      // Open Razorpay checkout
      return new Promise((resolve, reject) => {
        paymentService.openCheckout(
          order,
          styleId,
          async (paymentId) => {
            try {
              // Process purchase
              const result = await paymentService.processPurchase(
                styleId,
                paymentId,
                order.id,
                amount
              );
              resolve(result);
            } catch (error) {
              reject(error);
            }
          },
          (error) => {
            reject(error);
          }
        );
      });
    },
    onSuccess: () => {
      toast.success('Payment successful! Generating HD image...');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['styles'] });
      setIsProcessing(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Payment failed');
      setIsProcessing(false);
    },
  });

  const purchaseStyle = (styleId: string, amount: number) => {
    return purchaseMutation.mutateAsync({ styleId, amount });
  };

  return {
    purchaseStyle,
    isProcessing,
    isPending: purchaseMutation.isPending,
  };
}
