/**
 * Credit System TypeScript Types
 * All types for the credit-based monetization system.
 */

// ─── Credit Package ──────────────────────────────────────────────────────────
export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_inr: number;
  price_usd: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── User Credits Balance ─────────────────────────────────────────────────────
export interface UserCredits {
  free_credits_remaining: number;
  paid_credits: number;
  total_credits: number;
  last_credit_reset?: string;
}

// ─── Transaction ──────────────────────────────────────────────────────────────
export type TransactionStatus = 'created' | 'pending' | 'captured' | 'failed' | 'refunded';

export interface Transaction {
  id: string;
  package_name_snapshot: string;
  credits_added_snapshot: number;
  amount: number;
  currency: string;
  status: TransactionStatus;
  payment_id?: string;
  order_id?: string;
  created_at: string;
}

// ─── Generation History ───────────────────────────────────────────────────────
export type CreditType = 'free' | 'paid';
export type GenerationStatus = 'success' | 'failed';

export interface GenerationHistoryItem {
  id: string;
  prompt?: string;
  image_url?: string;
  credit_type: CreditType;
  credits_used: number;
  status: GenerationStatus;
  created_at: string;
  style_id?: string;
  styles?: {
    id: string;
    title: string;
    category: string;
  } | null;
}

// ─── Admin Config ─────────────────────────────────────────────────────────────
export interface AdminConfig {
  free_generations_per_month: string;
  credits_per_generation: string;
}

// ─── Razorpay Order Response ─────────────────────────────────────────────────
export interface CreateOrderResponse {
  order_id: string;
  amount: number;        // in paise
  amount_inr: number;    // human-readable
  currency: string;
  package_name: string;
  credits: number;
  razorpay_key_id: string;
}

// ─── Verify Payment Response ─────────────────────────────────────────────────
export interface VerifyPaymentResponse {
  success: boolean;
  already_captured: boolean;
  credits_added: number;
  free_credits_remaining: number;
  paid_credits: number;
  total_credits: number;
  message: string;
}

// ─── Paginated Response ───────────────────────────────────────────────────────
export interface PaginatedCreditsResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// ─── Razorpay Global Types (for window.Razorpay) ─────────────────────────────
// Note: window.Razorpay is already declared in src/lib/services/payment.service.ts
// We extend the existing declaration types here for reference only.
export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayPaymentResponse) => void;
  prefill?: {
    email?: string;
    name?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
