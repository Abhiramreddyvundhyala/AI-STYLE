import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';

export function useAuth() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: session, isLoading } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    },
  });

  const { data: user } = useQuery({
    queryKey: ['auth', 'user'],
    enabled: !!session,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const signInWithGoogle = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Signing in with Google...');
    },
    onError: (error: Error) => {
      toast.error('Failed to sign in', {
        description: error.message,
      });
    },
  });

  const signInWithEmail = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['credits', 'balance'] });
      toast.success('Welcome back!');
      // Refresh the page to update all queries
      setTimeout(() => window.location.reload(), 500);
    },
    onError: (error: Error) => {
      toast.error('Failed to sign in', {
        description: error.message,
      });
    },
  });

  const signUpWithEmail = useMutation({
    mutationFn: async ({ email, password, displayName, isSeller }: { email: string; password: string; displayName: string; isSeller?: boolean }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            is_seller: isSeller || false,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['credits', 'balance'] });
      
      // Check if email confirmation is required
      if (data.user && !data.session) {
        toast.success('Account created! Please check your email to verify.', {
          description: 'Check your spam folder if you don\'t see the email.',
          duration: 6000,
        });
      } else {
        // Auto-confirmed (email verification disabled in Supabase)
        toast.success('Account created successfully! Welcome aboard! 🎉');
        setTimeout(() => window.location.reload(), 500);
      }
    },
    onError: (error: Error) => {
      // Handle rate limit errors specifically
      if (error.message.toLowerCase().includes('rate limit')) {
        toast.error('Too many signup attempts', {
          description: 'Please wait a few minutes before trying again, or contact support if this persists.',
          duration: 8000,
        });
      } else {
        toast.error('Failed to sign up', {
          description: error.message,
        });
      }
    },
  });

  const signOut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.clear(); // Clear all cached data
      toast.success('Signed out successfully');
      navigate({ to: '/' });
    },
    onError: (error: Error) => {
      toast.error('Failed to sign out', {
        description: error.message,
      });
    },
  });

  return {
    session,
    user,
    isLoading,
    isAuthenticated: !!session,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };
}
