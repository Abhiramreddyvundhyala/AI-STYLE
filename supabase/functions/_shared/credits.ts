/**
 * Shared Credits Middleware
 * Provides atomic credit operations for all generate-* edge functions.
 * Uses Postgres functions (with FOR UPDATE locking) to prevent race conditions.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface CreditDeductionResult {
  creditType: 'free' | 'paid';
  freeCreditsRemaining: number;
  paidCredits: number;
}

/**
 * Deducts one credit from the user atomically.
 * Runs monthly reset check first.
 * Returns the credit type used ('free' | 'paid').
 * Throws with code INSUFFICIENT_CREDITS if no credits remain.
 */
export async function deductCredit(
  adminClient: SupabaseClient,
  userId: string
): Promise<CreditDeductionResult> {
  // Call the Postgres function that does SELECT FOR UPDATE + deduction in one atomic operation
  const { data, error } = await adminClient.rpc('deduct_credit', {
    p_user_id: userId,
  });

  if (error) {
    // Parse the custom error message from Postgres
    if (error.message?.includes('INSUFFICIENT_CREDITS')) {
      const customError = new Error(
        'You have used all available credits. Purchase credits to continue.'
      );
      (customError as any).code = 'INSUFFICIENT_CREDITS';
      throw customError;
    }
    throw new Error(`Credit deduction failed: ${error.message}`);
  }

  // Get updated balance
  const { data: balance } = await adminClient.rpc('get_user_balance', {
    p_user_id: userId,
  });

  return {
    creditType: data as 'free' | 'paid',
    freeCreditsRemaining: balance?.free_credits_remaining ?? 0,
    paidCredits: balance?.paid_credits ?? 0,
  };
}

/**
 * Atomically refunds one credit if generation fails after deduction.
 */
export async function refundCredit(
  adminClient: SupabaseClient,
  userId: string,
  creditType: 'free' | 'paid'
): Promise<void> {
  const { error } = await adminClient.rpc('refund_credit', {
    p_user_id: userId,
    p_credit_type: creditType,
  });

  if (error) {
    console.error(`[credits] CRITICAL: Failed to refund credit for user ${userId}:`, error.message);
    // Don't throw — we don't want a refund failure to mask the original generation error
  }
}

/**
 * Logs a generation attempt to generation_history.
 */
export async function logGeneration(
  adminClient: SupabaseClient,
  params: {
    userId: string;
    styleId?: string | null;
    prompt?: string | null;
    imageUrl?: string | null;
    creditType: 'free' | 'paid';
    status: 'success' | 'failed';
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await adminClient.from('generation_history').insert({
    user_id: params.userId,
    style_id: params.styleId ?? null,
    prompt: params.prompt ?? null,
    image_url: params.imageUrl ?? null,
    credit_type: params.creditType,
    credits_used: 1,
    status: params.status,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error(`[credits] Failed to log generation:`, error.message);
    // Non-fatal — don't throw
  }
}

/**
 * Gets current credit balance for a user (runs monthly reset if needed).
 */
export async function getUserBalance(
  adminClient: SupabaseClient,
  userId: string
): Promise<{ freeCreditsRemaining: number; paidCredits: number; totalCredits: number }> {
  const { data, error } = await adminClient.rpc('get_user_balance', {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(`Failed to get user balance: ${error.message}`);
  }

  return {
    freeCreditsRemaining: data?.free_credits_remaining ?? 0,
    paidCredits: data?.paid_credits ?? 0,
    totalCredits: data?.total_credits ?? 0,
  };
}
