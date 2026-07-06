/**
 * useStylePurchase Hook
 *
 * Manages the full "buy a style to download it" flow:
 *   1. Check if already purchased (from style_purchases table via RLS)
 *   2. If not: open Razorpay → server-side order → verify → insert style_purchase
 *   3. Trigger download of the generated image via a signed URL
 *
 * Security guarantees:
 * - All writes go through edge functions that verify the JWT
 * - Purchase check uses RLS (users can only see their own rows)
 * - Downloaded URL is fetched client-side (no permanent URL exposed)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { backendApi } from '@/lib/backendApi';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// ── Razorpay script loader ────────────────────────────────────────────────────
let rzpScriptPromise: Promise<void> | null = null;
function loadRazorpay(): Promise<void> {
  if (rzpScriptPromise) return rzpScriptPromise;
  rzpScriptPromise = new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(s);
  });
  return rzpScriptPromise;
}

// ── Check if user already purchased a style ───────────────────────────────────
export function useCheckStylePurchased(styleId: string | null | undefined) {
  const { user } = useAuth();

  return useQuery<boolean>({
    queryKey: ['style-purchases', 'check', styleId, user?.id],
    enabled: !!styleId && !!user,
    staleTime: 60 * 1000, // re-validate every minute
    queryFn: async () => {
      if (!styleId || !user) return false;

      const { data, error } = await supabase
        .from('style_purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('style_id', styleId)
        .eq('status', 'completed')
        .maybeSingle();

      if (error) {
        // Table not created yet — treat as not purchased
        if (error.code === '42P01') return false;
        console.warn('[useCheckStylePurchased]', error.message);
        return false;
      }

      return !!data;
    },
  });
}

// ── Full Razorpay purchase flow for a style ───────────────────────────────────
export function usePurchaseStyle() {
  const queryClient = useQueryClient();
  const { user, session } = useAuth();
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const mutation = useMutation<
    { success: boolean; purchase_id: string },
    Error,
    { styleId: string; styleTitle: string; stylePrice: number; sellerId?: string | null }
  >({
    mutationFn: async ({ styleId, styleTitle, stylePrice, sellerId }) => {
      if (!user || !session) throw new Error('Please sign in first');

      await loadRazorpay();

      // ── Step 1: Create Razorpay order via Render backend ────────────────────
      const orderData = await backendApi.post<{
        order_id: string;
        razorpay_key_id: string;
        amount: number;
        currency: string;
        style_title: string;
        already_purchased?: boolean;
        purchase_id?: string;
      }>('style-purchase', { style_id: styleId, currency: 'INR' });

      // Already purchased (free style or duplicate)
      if (orderData.already_purchased) {
        return { success: true, purchase_id: orderData.purchase_id ?? '' };
      }

      if (!orderData.order_id) throw new Error('No order data returned');

      // ── Step 2: Open Razorpay checkout ──────────────────────────────────────
      setIsPaymentOpen(true);

      const paymentResponse = await new Promise<{
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }>((resolve, reject) => {
        const options = {
          key: orderData.razorpay_key_id,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'PromptStyle',
          description: `Download: ${styleTitle}`,
          order_id: orderData.order_id,
          handler: (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => resolve(response),
          prefill: {
            email: user.email ?? '',
            name: user.user_metadata?.display_name ?? '',
          },
          theme: { color: '#7c3aed' },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled')),
          },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      });

      // ── Step 3: Verify payment + record purchase via Render backend ─────────
      const verifyData = await backendApi.post<{ success: boolean; purchase_id: string }>(
        'verify-style-purchase',
        { ...paymentResponse, style_id: styleId, seller_id: sellerId ?? null }
      );

      if (!verifyData?.success) throw new Error('Payment verification returned failure');
      return verifyData as { success: boolean; purchase_id: string };
    },

    onSuccess: (_data, variables) => {
      setIsPaymentOpen(false);
      // Invalidate the purchase check so download gate updates immediately
      queryClient.invalidateQueries({ queryKey: ['style-purchases', 'check', variables.styleId] });
      toast.success('Purchase successful! Downloading now... 🎉');
    },

    onError: (error) => {
      setIsPaymentOpen(false);
      if (error.message.includes('cancelled')) {
        toast.info('Payment cancelled');
      } else {
        toast.error('Purchase failed', { description: error.message });
      }
    },
  });

  const purchaseStyle = useCallback(
    (styleId: string, styleTitle: string, stylePrice: number, sellerId?: string | null) =>
      mutation.mutateAsync({ styleId, styleTitle, stylePrice, sellerId }),
    [mutation]
  );

  return {
    purchaseStyle,
    isPaymentOpen,
    isPending: mutation.isPending,
  };
}

// ── Download generated image (creates object URL to avoid exposing storage URL) ──
export function useDownloadImage() {
  const [isDownloading, setIsDownloading] = useState(false);

  const download = useCallback(async (imageUrl: string, filename: string) => {
    setIsDownloading(true);
    try {
      const response = await fetch(imageUrl, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      toast.success('Image downloaded! 🎉');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      toast.error('Download failed', { description: msg });
    } finally {
      setIsDownloading(false);
    }
  }, []);

  return { download, isDownloading };
}
