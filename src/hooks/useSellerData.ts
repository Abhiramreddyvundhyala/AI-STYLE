import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Style } from './useStyles';

export interface SellerStats {
  total_earnings: number;
  monthly_earnings: number;
  total_sales: number;
  active_styles: number;
}

export interface SellerStyle extends Style {
  views_count: number;
  prompt?: string; // Sellers can read their own style's prompt
}

// ─── Read seller's own styles from Supabase ───────────────────────────────────

export function useSellerStats(userId: string | undefined) {
  return useQuery({
    queryKey: ['seller', 'stats', userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      if (!userId) return null;

      // Try to fetch from Supabase first
      try {
        const { data: styles, error } = await supabase
          .from('styles')
          .select('price, sales_count, is_active')
          .eq('seller_id', userId);

        if (!error && styles) {
          const totalSales = styles.reduce((sum, s) => sum + s.sales_count, 0);
          const totalEarnings = styles.reduce(
            (sum, s) => sum + s.price * s.sales_count * 0.65,
            0
          );

          return {
            total_earnings: Math.round(totalEarnings),
            monthly_earnings: Math.round(totalEarnings * 0.25),
            total_sales: totalSales,
            active_styles: styles.filter(s => s.is_active).length,
          } as SellerStats;
        }
      } catch (err) {
        console.error('Failed to fetch from Supabase:', err);
      }

      // Return default zero stats if Supabase fails
      return {
        total_earnings: 0,
        monthly_earnings: 0,
        total_sales: 0,
        active_styles: 0,
      } as SellerStats;
    },
  });
}

export function useSellerStyles(userId: string | undefined) {
  return useQuery({
    queryKey: ['seller', 'styles', userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    queryFn: async () => {
      if (!userId) return [];

      // Try to fetch from Supabase first
      try {
        const { data: styles, error } = await supabase
          .from('styles')
          .select('id, title, category, price, sales_count, is_active, views_count, created_at, sample_image_url, description')
          .eq('seller_id', userId)
          .order('created_at', { ascending: false });

        if (!error && styles) {
          return styles.map(style => ({
            ...style,
            views_count: style.views_count || 0,
            seller: { display_name: 'You' },
          })) as SellerStyle[];
        }
        
        // Return empty array if error
        return [];
      } catch (err) {
        console.error('Failed to fetch from Supabase:', err);
        return [];
      }
    },
  });
}

export function useMonthlyEarnings(userId: string | undefined) {
  return useQuery({
    queryKey: ['seller', 'earnings', 'monthly', userId],
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    queryFn: async () => {
      if (!userId) return [];

      // Try to get real earnings from Supabase
      try {
        const { data: styles } = await supabase
          .from('styles')
          .select('price, sales_count, created_at')
          .eq('seller_id', userId);

        if (styles && styles.length > 0) {
          const now = new Date();
          const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
          
          return months.map((month, idx) => {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
            const nextMonth = new Date(now.getFullYear(), now.getMonth() - (5 - idx) + 1, 1);
            
            const earnings = styles
              .filter(s => {
                const created = new Date(s.created_at);
                return created >= monthDate && created < nextMonth;
              })
              .reduce((sum, s) => sum + (s.price * s.sales_count * 0.65), 0);
            
            return {
              month,
              value: Math.round(earnings),
            };
          });
        }
      } catch (err) {
        console.error('Failed to fetch earnings:', err);
      }

      // Return empty data instead of dummy data
      const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
      return months.map(m => ({ month: m, value: 0 }));
    },
  });
}

// ─── Create style — saves to Supabase database for ALL users to see ─────────────────────────

export function useCreateStyle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (styleData: {
      title: string;
      category: string;
      price: number;
      description: string;
      sample_image_url: string;
      seller_id: string;
      tags?: string[];
      prompt?: string;
    }) => {
      // Save to Supabase database so ALL users can see it
      try {
        // Ensure seller record exists using upsert (handles race conditions and RLS)
        const { data: { user } } = await supabase.auth.getUser();
        const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Seller';
        
        const { error: sellerError } = await supabase
          .from('sellers')
          .upsert({
            id: styleData.seller_id,
            display_name: displayName,
            total_earnings: 0,
            pending_withdrawal: 0,
            is_verified: false,
          }, { onConflict: 'id', ignoreDuplicates: true });

        if (sellerError) {
          console.warn('Seller upsert warning (may be OK if already exists):', sellerError.message);
        }
        
        // Store the prompt as plain text (no encryption needed)
        // The prompt column is not exposed to public via RLS policies
        // Only edge functions with service_role key can read it
        if (!styleData.prompt) {
          throw new Error('Prompt is required');
        }

        console.log('Storing prompt securely (server-side only access)');

        const { data, error } = await supabase
          .from('styles')
          .insert({
            title: styleData.title,
            category: styleData.category,
            price: styleData.price,
            description: styleData.description,
            sample_image_url: styleData.sample_image_url,
            seller_id: styleData.seller_id,
            tags: styleData.tags ?? [],
            prompt: styleData.prompt, // Store as plain text, secure via RLS
            is_active: true,
            sales_count: 0,
            avg_rating: 4.5,
          })
          .select()
          .single();

        if (error) throw error;
        
        return data;
      } catch (error) {
        console.error('Failed to save to Supabase:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate all relevant queries so UI updates immediately
      queryClient.invalidateQueries({ queryKey: ['styles'] });
      queryClient.invalidateQueries({ queryKey: ['seller', 'styles'] });
      queryClient.invalidateQueries({ queryKey: ['seller', 'stats'] });
      toast.success('Style uploaded! 🎉', {
        description: 'Your style is now live and visible to all users!',
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to create style', {
        description: error.message,
      });
    },
  });
}

// ─── Update style ─────────────────────────────────────────────────────────────

export function useUpdateStyle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Style> & { prompt?: string } }) => {
      // Update in Supabase - prompts stored as plain text, secure via RLS
      try {
        const { data, error } = await supabase
          .from('styles')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Failed to update in Supabase:', error);
        throw error;
      }
    },
    onSuccess: async (data, variables) => {
      // Force refetch all seller queries immediately
      await queryClient.refetchQueries({ 
        queryKey: ['seller'],
        type: 'active'
      });
      
      // Also invalidate for good measure
      queryClient.invalidateQueries({ queryKey: ['seller', 'styles'] });
      queryClient.invalidateQueries({ queryKey: ['seller', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['styles'] });
      
      if ('is_active' in variables.updates) {
        const status = variables.updates.is_active ? 'activated' : 'paused';
        toast.success(`Style ${status} successfully`);
      } else {
        toast.success('Style updated successfully');
      }
    },
    onError: (err: any) => {
      toast.error('Failed to update style', { description: err.message });
    },
  });
}

// ─── Delete style ─────────────────────────────────────────────────────────────

export function useDeleteStyle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Try to delete from Supabase first
      try {
        const { error } = await supabase
          .from('styles')
          .delete()
          .eq('id', id);

        if (error) throw error;
      } catch (error) {
        console.error('Failed to delete from Supabase:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'styles'] });
      queryClient.invalidateQueries({ queryKey: ['styles'] });
      toast.success('Style deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete style', { description: error.message });
    },
  });
}
