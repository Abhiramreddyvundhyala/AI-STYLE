/**
 * useCredits Hook
 * Manages credit balance fetching, buying credits, and history.
 *
 * Architecture:
 * - Read-only operations (balance, transactions, generations, packages) →
 *   Direct Supabase JS client queries. No raw fetch, no CORS issues.
 *   RLS policies enforce that users only see their own data.
 *
 * - Write/payment operations (create-order, verify-payment) →
 *   supabase.functions.invoke() — Supabase SDK handles auth headers + CORS
 *   automatically. Requires these two functions to be deployed.
 *
 * - Monthly reset →
 *   Called via supabase.rpc() which also handles CORS via the Supabase SDK.
 */

import { useState, useCallback } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { backendApi } from '@/lib/backendApi';
import { toast } from 'sonner';
import type {
  UserCredits,
  CreditPackage,
  CreateOrderResponse,
  VerifyPaymentResponse,
  Transaction,
  GenerationHistoryItem,
  PaginatedCreditsResponse,
  RazorpayOptions,
} from '@/lib/credits.types';

// ─── Razorpay Script Loader ───────────────────────────────────────────────────
let razorpayScriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}

// ─── Helper: get authenticated user ID ───────────────────────────────────────
async function getAuthenticatedUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ─── Helper: trigger monthly reset + return balance ──────────────────────────
// Calls the Postgres function that does SELECT FOR UPDATE + reset if needed.
// Falls back to direct table query if the RPC function isn't available yet.
async function fetchBalanceWithReset(userId: string): Promise<UserCredits> {
  // Try the RPC function first (runs monthly reset atomically)
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_balance', {
    p_user_id: userId,
  });

  if (!rpcError && rpcData) {
    return {
      free_credits_remaining: rpcData.free_credits_remaining ?? 0,
      paid_credits: rpcData.paid_credits ?? 0,
      total_credits: rpcData.total_credits ?? 0,
      last_credit_reset: rpcData.last_credit_reset,
    };
  }

  // Fallback: direct table query (works even if migration not applied yet)
  const { data: row, error: rowError } = await supabase
    .from('user_credits')
    .select('free_credits_remaining, paid_credits, last_credit_reset')
    .eq('user_id', userId)
    .single();

  if (rowError || !row) {
    // Table doesn't exist yet or user has no row — return safe defaults
    return { free_credits_remaining: 3, paid_credits: 0, total_credits: 3 };
  }

  return {
    free_credits_remaining: row.free_credits_remaining ?? 0,
    paid_credits: row.paid_credits ?? 0,
    total_credits: (row.free_credits_remaining ?? 0) + (row.paid_credits ?? 0),
    last_credit_reset: row.last_credit_reset,
  };
}

// ─── Fetch Packages (public — for credit store display) ──────────────────────
// Uses direct Supabase client — no edge function needed.
export function usePackages() {
  return useQuery<CreditPackage[]>({
    queryKey: ['credit-packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('is_active', true)
        .order('credits', { ascending: true });

      if (error) {
        // Table doesn't exist yet (migration not run) — return hardcoded defaults
        // so the UI doesn't break before migration is applied
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('[usePackages] packages table not found — run the SQL migration');
          return [
            { id: 'starter', name: 'Starter Pack', credits: 10, price_inr: 149, price_usd: 1.79, is_active: true, created_at: '', updated_at: '' },
            { id: 'popular', name: 'Popular Pack', credits: 25, price_inr: 349, price_usd: 4.19, is_active: true, created_at: '', updated_at: '' },
            { id: 'pro',     name: 'Pro Pack',     credits: 75, price_inr: 899, price_usd: 10.79, is_active: true, created_at: '', updated_at: '' },
          ] as CreditPackage[];
        }
        throw new Error(error.message);
      }
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── Fetch Credit Balance ─────────────────────────────────────────────────────
// Direct Supabase queries — no edge function, no CORS issues.
export function useCreditsBalance() {
  return useQuery<UserCredits>({
    queryKey: ['credits', 'balance'],
    queryFn: async () => {
      const userId = await getAuthenticatedUserId();
      if (!userId) {
        return { free_credits_remaining: 0, paid_credits: 0, total_credits: 0 };
      }
      return fetchBalanceWithReset(userId);
    },
    staleTime: 30 * 1000,
    retry: 1,
    throwOnError: false,
  });
}

// ─── Buy Credits (create order → Razorpay checkout → verify) ─────────────────
// Uses supabase.functions.invoke() which handles CORS + auth headers correctly.
export function useBuyCredits() {
  const queryClient = useQueryClient();
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const buyMutation = useMutation<
    VerifyPaymentResponse,
    Error,
    { packageId: string; currency?: string; userEmail?: string; userName?: string }
  >({
    mutationFn: async ({ packageId, currency = 'INR', userEmail, userName }) => {
      // Step 1: Load Razorpay checkout.js
      await loadRazorpayScript();

      // Step 2: Create Razorpay order via Render backend
      const orderData = await backendApi.post<CreateOrderResponse>(
        'create-payment-order',
        { package_id: packageId, currency }
      );

      if (!orderData) throw new Error('No order data returned');

      // Step 3: Open Razorpay Checkout modal
      setIsPaymentOpen(true);

      const paymentResponse = await new Promise<{
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }>((resolve, reject) => {
      const rzpKey = orderData.razorpay_key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!rzpKey || rzpKey === 'rzp_test_your_key_id') {
        throw new Error(
          'Razorpay key not configured. Please set your Razorpay key in .env (VITE_RAZORPAY_KEY_ID) ' +
          'and in Supabase Edge Function secrets (RAZORPAY_KEY_ID).'
        );
      }

        const options: RazorpayOptions = {
          key: rzpKey,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'PromptStyle AI',
          description: `${orderData.package_name} — ${orderData.credits} Credits`,
          order_id: orderData.order_id,
          handler: (response) => resolve(response),
          prefill: { email: userEmail, name: userName },
          theme: { color: '#7c3aed' },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled by user')),
          },
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      });

      // Step 4: Verify payment signature + atomically add credits via Render backend
      const verifyData = await backendApi.post<VerifyPaymentResponse>(
        'verify-payment',
        paymentResponse
      );

      if (!verifyData) throw new Error('No verification data returned');
      return verifyData;
    },

    onSuccess: (data) => {
      setIsPaymentOpen(false);
      queryClient.invalidateQueries({ queryKey: ['credits', 'balance'] });
      queryClient.invalidateQueries({ queryKey: ['credits', 'transactions'] });

      toast.success(`${data.credits_added} credits added! 🎉`, {
        description: `Balance: ${data.paid_credits} paid + ${data.free_credits_remaining} free credits`,
        duration: 5000,
      });
    },

    onError: (error) => {
      setIsPaymentOpen(false);
      if (error.message.includes('cancelled')) {
        toast.info('Payment cancelled');
      } else {
        toast.error('Payment failed', { description: error.message });
      }
    },
  });

  const buyCredits = useCallback(
    (packageId: string, opts?: { currency?: string; userEmail?: string; userName?: string }) => {
      return buyMutation.mutateAsync({ packageId, ...opts });
    },
    [buyMutation]
  );

  return { buyCredits, isPaymentOpen, isPending: buyMutation.isPending };
}

// ─── Transaction History (paginated) ─────────────────────────────────────────
// Direct Supabase query — RLS ensures users only see their own transactions.
export function useTransactionHistory(page = 1, pageSize = 20) {
  return useQuery<PaginatedCreditsResponse<Transaction>>({
    queryKey: ['credits', 'transactions', page, pageSize],
    queryFn: async () => {
      const userId = await getAuthenticatedUserId();
      if (!userId) return { data: [], total: 0, page, page_size: pageSize, has_more: false };

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('transactions')
        .select(
          'id, package_name_snapshot, credits_added_snapshot, amount, currency, status, payment_id, order_id, created_at',
          { count: 'exact' }
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        if (error.code === '42P01') return { data: [], total: 0, page, page_size: pageSize, has_more: false };
        throw new Error(error.message);
      }

      const total = count ?? 0;
      return {
        data: (data ?? []) as Transaction[],
        total,
        page,
        page_size: pageSize,
        has_more: from + pageSize < total,
      };
    },
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });
}

// ─── Generation History (paginated) ──────────────────────────────────────────
// Direct Supabase query — RLS ensures users only see their own history.
export function useGenerationHistory(page = 1, pageSize = 20) {
  return useQuery<PaginatedCreditsResponse<GenerationHistoryItem>>({
    queryKey: ['credits', 'generations', page, pageSize],
    queryFn: async () => {
      const userId = await getAuthenticatedUserId();
      if (!userId) return { data: [], total: 0, page, page_size: pageSize, has_more: false };

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('generation_history')
        .select(
          `id, prompt, image_url, credit_type, credits_used, status, created_at, style_id,
           styles ( id, title, category )`,
          { count: 'exact' }
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        if (error.code === '42P01') return { data: [], total: 0, page, page_size: pageSize, has_more: false };
        throw new Error(error.message);
      }

      const total = count ?? 0;
      return {
        data: (data ?? []) as unknown as GenerationHistoryItem[],
        total,
        page,
        page_size: pageSize,
        has_more: from + pageSize < total,
      };
    },
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });
}

// ─── Refresh balance helper (call after generation) ───────────────────────────
export function useRefreshCredits() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['credits', 'balance'] });
  }, [queryClient]);
}
