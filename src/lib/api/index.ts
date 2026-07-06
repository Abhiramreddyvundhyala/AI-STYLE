/**
 * API Client
 * Central API client for all backend operations
 */

import { supabase } from '../supabase';
import type {
  Style,
  Seller,
  Purchase,
  Rating,
  Withdrawal,
  CreateStyleInput,
  UpdateStyleInput,
  CreateRatingInput,
  CreateWithdrawalInput,
} from '../types/database';

// ─── Styles API ─────────────────────────────────────────────────────────────

export const stylesApi = {
  /**
   * Get all active styles with optional filters
   */
  async getAll(filters?: {
    category?: string;
    search?: string;
    sortBy?: 'popular' | 'newest' | 'price_low' | 'price_high' | 'rating';
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('styles')
      .select(`
        *,
        seller:sellers(id, display_name, is_verified)
      `)
      .eq('is_active', true);

    // Apply filters
    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,tags.cs.{${filters.search}}`
      );
    }

    // Apply sorting
    switch (filters?.sortBy) {
      case 'popular':
        query = query.order('sales_count', { ascending: false });
        break;
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'price_low':
        query = query.order('price', { ascending: true });
        break;
      case 'price_high':
        query = query.order('price', { ascending: false });
        break;
      case 'rating':
        query = query.order('avg_rating', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as Style[];
  },

  /**
   * Get a single style by ID
   */
  async getById(id: string) {
    const { data, error } = await supabase
      .from('styles')
      .select(`
        *,
        seller:sellers(id, display_name, is_verified)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Style;
  },

  /**
   * Get trending styles (top by sales)
   */
  async getTrending(limit = 5) {
    const { data, error } = await supabase
      .from('styles')
      .select(`
        *,
        seller:sellers(id, display_name, is_verified)
      `)
      .eq('is_active', true)
      .order('sales_count', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data as Style[];
  },

  /**
   * Get styles by seller
   */
  async getBySeller(sellerId: string) {
    const { data, error } = await supabase
      .from('styles')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Style[];
  },

  /**
   * Create a new style (seller only)
   */
  async create(input: CreateStyleInput) {
    const { data, error } = await supabase
      .from('styles')
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data as Style;
  },

  /**
   * Update a style (seller only)
   */
  async update(id: string, input: UpdateStyleInput) {
    const { data, error } = await supabase
      .from('styles')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Style;
  },

  /**
   * Delete a style (seller only)
   */
  async delete(id: string) {
    const { error } = await supabase
      .from('styles')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Toggle style active status
   */
  async toggleActive(id: string, isActive: boolean) {
    const { data, error } = await supabase
      .from('styles')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Style;
  },
};

// ─── Sellers API ────────────────────────────────────────────────────────────

export const sellersApi = {
  /**
   * Get seller profile
   */
  async getProfile(sellerId: string) {
    const { data, error } = await supabase
      .from('sellers')
      .select('*')
      .eq('id', sellerId)
      .single();

    if (error) throw error;
    return data as Seller;
  },

  /**
   * Create seller profile
   */
  async create(input: { id: string; display_name: string; upi_id?: string }) {
    const { data, error } = await supabase
      .from('sellers')
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data as Seller;
  },

  /**
   * Update seller profile
   */
  async update(sellerId: string, input: Partial<Seller>) {
    const { data, error } = await supabase
      .from('sellers')
      .update(input)
      .eq('id', sellerId)
      .select()
      .single();

    if (error) throw error;
    return data as Seller;
  },

  /**
   * Get seller stats
   */
  async getStats(sellerId: string) {
    const [seller, styles, purchases] = await Promise.all([
      this.getProfile(sellerId),
      stylesApi.getBySeller(sellerId),
      purchasesApi.getBySeller(sellerId),
    ]);

    const totalSales = styles.reduce((sum, style) => sum + style.sales_count, 0);
    const totalRevenue = purchases.reduce((sum, purchase) => sum + purchase.seller_cut, 0);

    return {
      seller,
      totalStyles: styles.length,
      totalSales,
      totalRevenue,
      pendingWithdrawal: seller.pending_withdrawal,
      totalEarnings: seller.total_earnings,
    };
  },
};

// ─── Purchases API ──────────────────────────────────────────────────────────

export const purchasesApi = {
  /**
   * Get user's purchases
   */
  async getByUser(userId: string) {
    const { data, error } = await supabase
      .from('purchases')
      .select(`
        *,
        style:styles(
          id,
          title,
          category,
          sample_image_url,
          seller:sellers(display_name)
        )
      `)
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Purchase[];
  },

  /**
   * Get purchases for a seller's styles
   */
  async getBySeller(sellerId: string) {
    const { data, error } = await supabase
      .from('purchases')
      .select(`
        *,
        style:styles!inner(id, title, seller_id)
      `)
      .eq('style.seller_id', sellerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Purchase[];
  },

  /**
   * Check if user has purchased a style
   */
  async hasPurchased(userId: string, styleId: string) {
    const { data, error } = await supabase
      .from('purchases')
      .select('id')
      .eq('buyer_id', userId)
      .eq('style_id', styleId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  },

  /**
   * Create a purchase record
   */
  async create(input: {
    buyer_id: string;
    style_id: string;
    amount: number;
    platform_cut: number;
    seller_cut: number;
    razorpay_payment_id?: string;
    razorpay_order_id?: string;
    hd_image_url?: string;
  }) {
    const { data, error } = await supabase
      .from('purchases')
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data as Purchase;
  },
};

// ─── Ratings API ────────────────────────────────────────────────────────────

export const ratingsApi = {
  /**
   * Get ratings for a style
   */
  async getByStyle(styleId: string) {
    const { data, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('style_id', styleId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Rating[];
  },

  /**
   * Get user's rating for a style
   */
  async getUserRating(userId: string, styleId: string) {
    const { data, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('buyer_id', userId)
      .eq('style_id', styleId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Rating | null;
  },

  /**
   * Create or update a rating
   */
  async upsert(input: CreateRatingInput) {
    const { data, error } = await supabase
      .from('ratings')
      .upsert(input, { onConflict: 'buyer_id,style_id' })
      .select()
      .single();

    if (error) throw error;
    return data as Rating;
  },

  /**
   * Delete a rating
   */
  async delete(userId: string, styleId: string) {
    const { error } = await supabase
      .from('ratings')
      .delete()
      .eq('buyer_id', userId)
      .eq('style_id', styleId);

    if (error) throw error;
  },
};

// ─── Withdrawals API ────────────────────────────────────────────────────────

export const withdrawalsApi = {
  /**
   * Get seller's withdrawals
   */
  async getBySeller(sellerId: string) {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Withdrawal[];
  },

  /**
   * Create a withdrawal request
   */
  async create(input: CreateWithdrawalInput) {
    const { data, error } = await supabase
      .from('withdrawals')
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data as Withdrawal;
  },

  /**
   * Update withdrawal status (admin only)
   */
  async updateStatus(
    withdrawalId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed'
  ) {
    const { data, error } = await supabase
      .from('withdrawals')
      .update({ status })
      .eq('id', withdrawalId)
      .select()
      .single();

    if (error) throw error;
    return data as Withdrawal;
  },
};

// ─── Export All ─────────────────────────────────────────────────────────────

export const api = {
  styles: stylesApi,
  sellers: sellersApi,
  purchases: purchasesApi,
  ratings: ratingsApi,
  withdrawals: withdrawalsApi,
};

export default api;
