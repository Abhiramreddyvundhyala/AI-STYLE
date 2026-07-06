import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Style } from './useStyles';

export function useWishlist() {
  const queryClient = useQueryClient();

  // Fetch user's wishlist
  const { data: wishlist = [], isLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_wishlists')
        .select('style_id')
        .eq('user_id', user.id);

      if (error) throw error;
      return data.map(w => w.style_id);
    },
  });

  // Add to wishlist
  const addToWishlist = useMutation({
    mutationFn: async (styleId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in to save favorites');

      const { error } = await supabase
        .from('user_wishlists')
        .insert({ user_id: user.id, style_id: styleId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast.success('Added to favorites');
    },
    onError: (error: Error) => {
      toast.error('Failed to add to favorites', {
        description: error.message,
      });
    },
  });

  // Remove from wishlist
  const removeFromWishlist = useMutation({
    mutationFn: async (styleId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in');

      const { error } = await supabase
        .from('user_wishlists')
        .delete()
        .eq('user_id', user.id)
        .eq('style_id', styleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast.info('Removed from favorites');
    },
    onError: (error: Error) => {
      toast.error('Failed to remove from favorites', {
        description: error.message,
      });
    },
  });

  // Toggle wishlist
  const toggleWishlist = (styleOrId: Style | string) => {
    const id = typeof styleOrId === 'string' ? styleOrId : styleOrId.id;
    const isInWishlist = wishlist.includes(id);

    if (isInWishlist) {
      removeFromWishlist.mutate(id);
    } else {
      addToWishlist.mutate(id);
    }
  };

  return {
    wishlist,
    isLoading,
    toggleWishlist,
    isInWishlist: (styleId: string) => wishlist.includes(styleId),
  };
}
