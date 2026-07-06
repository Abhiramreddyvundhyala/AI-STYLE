/**
 * Database Types
 * TypeScript types for all database tables and operations
 */

// ─── Base Types ─────────────────────────────────────────────────────────────

export interface Seller {
  id: string;
  display_name: string;
  upi_id: string | null;
  bank_account: string | null;
  total_earnings: number;
  pending_withdrawal: number;
  is_verified: boolean;
  created_at: string;
}

export interface Style {
  id: string;
  title: string;
  category: string;
  price: number;
  sample_image_url: string;
  prompt: string; // Plain text, server-side only access via RLS
  description: string | null;
  seller_id: string;
  sales_count: number;
  avg_rating: number;
  is_active: boolean;
  tags: string[] | null;
  created_at: string;
  seller?: {
    id: string;
    display_name: string;
    is_verified: boolean;
  };
}

export interface Purchase {
  id: string;
  buyer_id: string;
  style_id: string;
  amount: number;
  platform_cut: number;
  seller_cut: number;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  hd_image_url: string | null;
  created_at: string;
  style?: {
    id: string;
    title: string;
    category: string;
    sample_image_url: string;
    seller: {
      display_name: string;
    };
  };
}

export interface Rating {
  id: string;
  buyer_id: string;
  style_id: string;
  stars: number;
  review_text: string | null;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  seller_id: string;
  amount: number;
  upi_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

export interface ModelSetting {
  id: string;
  model_id: string;
  is_enabled: boolean;
  updated_at: string;
  updated_by: string | null;
  created_at: string;
}

// ─── Input Types ────────────────────────────────────────────────────────────

export interface CreateStyleInput {
  title: string;
  category: string;
  price: number;
  sample_image_url: string;
  prompt: string;
  description?: string;
  seller_id: string;
  tags?: string[];
}

export interface UpdateStyleInput {
  title?: string;
  category?: string;
  price?: number;
  sample_image_url?: string;
  description?: string;
  is_active?: boolean;
  tags?: string[];
}

export interface CreateRatingInput {
  buyer_id: string;
  style_id: string;
  stars: number;
  review_text?: string;
}

export interface CreateWithdrawalInput {
  seller_id: string;
  amount: number;
  upi_id: string;
}

// ─── Response Types ─────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─── Filter Types ───────────────────────────────────────────────────────────

export interface StyleFilters {
  category?: string;
  search?: string;
  sortBy?: 'popular' | 'newest' | 'price_low' | 'price_high' | 'rating';
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  tags?: string[];
  sellerId?: string;
  limit?: number;
  offset?: number;
}

// ─── Stats Types ────────────────────────────────────────────────────────────

export interface SellerStats {
  seller: Seller;
  totalStyles: number;
  totalSales: number;
  totalRevenue: number;
  pendingWithdrawal: number;
  totalEarnings: number;
}

export interface StyleStats {
  style: Style;
  totalSales: number;
  totalRevenue: number;
  avgRating: number;
  totalRatings: number;
}

// ─── Payment Types ──────────────────────────────────────────────────────────

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export interface PaymentVerification {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// ─── AI Types ───────────────────────────────────────────────────────────────

export interface AIGenerationRequest {
  styleId: string;
  userImageUrl: string;
  userId: string;
}

export interface AIGenerationResponse {
  previewUrl: string; // Watermarked
  hdUrl?: string; // Only after payment
  generationId: string;
}

// ─── Storage Types ──────────────────────────────────────────────────────────

export interface UploadResult {
  url: string;
  path: string;
  bucket: string;
}

export type StorageBucket = 'style-samples' | 'user-uploads' | 'hd-outputs';

// ─── Categories ─────────────────────────────────────────────────────────────

export const CATEGORIES = [
  'Professional',
  'Artistic',
  'Vintage',
  'Cinematic',
  'Fantasy',
  'Minimalist',
  'Glamour',
  'Anime',
] as const;

export type Category = (typeof CATEGORIES)[number];

// ─── Constants ──────────────────────────────────────────────────────────────

export const PLATFORM_CUT_PERCENTAGE = 35;
export const SELLER_CUT_PERCENTAGE = 65;
export const MIN_WITHDRAWAL_AMOUNT = 500; // ₹500
export const MAX_STYLE_PRICE = 999; // ₹999
export const MIN_STYLE_PRICE = 49; // ₹49
