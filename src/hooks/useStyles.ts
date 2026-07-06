import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface Style {
  id: string;
  title: string;
  category: string;
  price: number;
  sample_image_url: string;
  description: string | null;
  seller_id: string;
  sales_count: number;
  avg_rating: number;
  is_active: boolean;
  tags: string[] | null;
  created_at: string;
  views_count?: number;
  seller?: {
    display_name: string;
  };
}

// ─── Hook: subscribe to database changes and refetch ────────────────────
export function useStylesSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    // Realtime temporarily disabled due to unhealthy service
    // Uncomment when Supabase project is restored
    /*
    const channel = supabase
      .channel('styles-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'styles' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['styles'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    */
    
    // Empty cleanup - app will work, just without live updates
    return () => {};
  }, [queryClient]);
}

// ─── Fetch from Supabase only ───────────────────────────────────
async function fetchFromSupabase(category?: string): Promise<Style[]> {
  try {
    let query = supabase
      .from('styles')
      .select(`
        id,
        title,
        category,
        price,
        sample_image_url,
        description,
        seller_id,
        sales_count,
        avg_rating,
        is_active,
        tags,
        created_at,
        views_count,
        seller:sellers(display_name)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (category && category !== 'All') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching styles:', error);
      return [];
    }

    return (data || []).map((style: any) => ({
      ...style,
      seller: Array.isArray(style.seller) ? style.seller[0] : style.seller,
    })) as Style[];
  } catch (err) {
    console.error('Failed to fetch styles:', err);
    return [];
  }
}

// ─── Main hooks ───────────────────────────────────────────────────────────────

export function useStyles(category?: string) {
  return useQuery({
    queryKey: ['styles', category],
    queryFn: async () => {
      return await fetchFromSupabase(category);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });
}

export function useStyle(id: string | null) {
  return useQuery({
    queryKey: ['style', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;

      try {
        const { data, error } = await supabase
          .from('styles')
          .select(`
            id,
            title,
            category,
            price,
            sample_image_url,
            description,
            seller_id,
            sales_count,
            avg_rating,
            is_active,
            tags,
            created_at,
            seller:sellers(display_name)
          `)
          .eq('id', id)
          .single();

        if (error) return null;

        return {
          ...data,
          seller: Array.isArray((data as any).seller) ? (data as any).seller[0] : (data as any).seller,
        } as Style;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useTrendingStyles(limit = 6) {
  return useQuery({
    queryKey: ['styles', 'trending', limit],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('styles')
          .select(`
            id,
            title,
            category,
            price,
            sample_image_url,
            description,
            seller_id,
            sales_count,
            avg_rating,
            is_active,
            tags,
            created_at,
            seller:sellers(display_name)
          `)
          .eq('is_active', true)
          .order('sales_count', { ascending: false })
          .limit(limit);

        if (error) return [];
        return (data || []).map((style: any) => ({
          ...style,
          seller: Array.isArray(style.seller) ? style.seller[0] : style.seller,
        })) as Style[];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
}
