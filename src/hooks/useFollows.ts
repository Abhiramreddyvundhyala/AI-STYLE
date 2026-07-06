import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function useFollows() {
  const queryClient = useQueryClient();

  // Fetch user's follows
  const { data: follows = [], isLoading } = useQuery({
    queryKey: ['follows'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_follows')
        .select('seller_id')
        .eq('follower_id', user.id);

      if (error) throw error;
      return data.map(f => f.seller_id);
    },
  });

  // Follow a seller
  const followSeller = useMutation({
    mutationFn: async (sellerId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in to follow sellers');

      const { error } = await supabase
        .from('user_follows')
        .insert({ follower_id: user.id, seller_id: sellerId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follows'] });
      toast.success('Following seller');
    },
    onError: (error: Error) => {
      toast.error('Failed to follow', {
        description: error.message,
      });
    },
  });

  // Unfollow a seller
  const unfollowSeller = useMutation({
    mutationFn: async (sellerId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in');

      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('seller_id', sellerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follows'] });
      toast.info('Unfollowed seller');
    },
    onError: (error: Error) => {
      toast.error('Failed to unfollow', {
        description: error.message,
      });
    },
  });

  // Toggle follow
  const toggleFollow = (sellerId: string) => {
    const isFollowing = follows.includes(sellerId);

    if (isFollowing) {
      unfollowSeller.mutate(sellerId);
    } else {
      followSeller.mutate(sellerId);
    }
  };

  return {
    follows,
    isLoading,
    toggleFollow,
    isFollowing: (sellerId: string) => follows.includes(sellerId),
  };
}
