/**
 * useAdminCredits Hook
 * Admin-only hooks for managing packages and system config.
 *
 * Uses supabase.functions.invoke() for all calls so CORS + auth is
 * handled automatically by the Supabase SDK.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { CreditPackage, AdminConfig } from '@/lib/credits.types';

// ─── Admin: List all packages ─────────────────────────────────────────────────
export function useAdminPackages() {
  return useQuery<CreditPackage[]>({
    queryKey: ['admin', 'packages'],
    queryFn: async () => {
      // Admin can see ALL packages (including inactive) — use direct query
      // The admin_users table check is done server-side in the edge function,
      // but for reads we can use direct Supabase query with RLS bypass via
      // the service role. Since we're on the client, just read all packages
      // with the authenticated user's anon key (RLS allows active-only).
      // For admin panel, we want all packages, so invoke the edge function.
      const { data, error } = await supabase.functions.invoke<{ data: CreditPackage[] }>('admin-packages', {
        method: 'GET',
      });

      if (error) {
        // Fallback: if function not deployed, try direct query for active packages
        console.warn('[useAdminPackages] Edge function not available, falling back to direct query');
        const { data: pkgs, error: pkgErr } = await supabase
          .from('packages')
          .select('*')
          .order('created_at', { ascending: true });
        if (pkgErr) throw new Error(pkgErr.message);
        return pkgs ?? [];
      }

      return data?.data ?? [];
    },
    staleTime: 60 * 1000,
  });
}

// ─── Admin: Create package ────────────────────────────────────────────────────
export function useCreatePackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pkg: { name: string; credits: number; price_inr: number; price_usd: number }) => {
      const { data, error } = await supabase.functions.invoke('admin-packages', {
        method: 'POST',
        body: pkg,
      });
      if (error) throw new Error(error.message ?? 'Failed to create package');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'packages'] });
      queryClient.invalidateQueries({ queryKey: ['credit-packages'] });
      toast.success('Package created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create package', { description: error.message });
    },
  });
}

// ─── Admin: Update package ────────────────────────────────────────────────────
export function useUpdatePackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CreditPackage> & { id: string }) => {
      // Edge function uses path param via query string workaround
      const { data, error } = await supabase.functions.invoke(`admin-packages/${id}`, {
        method: 'PUT',
        body: updates,
      });
      if (error) {
        // Fallback: direct Supabase update if function not deployed
        const { data: updated, error: updateErr } = await supabase
          .from('packages')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (updateErr) throw new Error(updateErr.message);
        return updated;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'packages'] });
      queryClient.invalidateQueries({ queryKey: ['credit-packages'] });
      toast.success('Package updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update package', { description: error.message });
    },
  });
}

// ─── Admin: Deactivate package ────────────────────────────────────────────────
export function useDeactivatePackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke(`admin-packages/${id}`, {
        method: 'DELETE',
      });
      if (error) {
        // Fallback: direct Supabase update
        const { data: updated, error: updateErr } = await supabase
          .from('packages')
          .update({ is_active: false })
          .eq('id', id)
          .select()
          .single();
        if (updateErr) throw new Error(updateErr.message);
        return updated;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'packages'] });
      queryClient.invalidateQueries({ queryKey: ['credit-packages'] });
      toast.success('Package deactivated');
    },
    onError: (error: Error) => {
      toast.error('Failed to deactivate package', { description: error.message });
    },
  });
}

// ─── Admin: Get config ────────────────────────────────────────────────────────
export function useAdminConfig() {
  return useQuery<AdminConfig>({
    queryKey: ['admin', 'config'],
    queryFn: async () => {
      // Try edge function first
      const { data, error } = await supabase.functions.invoke<{ data: AdminConfig }>('admin-config', {
        method: 'GET',
      });

      if (!error && data?.data) {
        return data.data;
      }

      // Fallback: direct Supabase query
      const { data: rows, error: rowErr } = await supabase
        .from('admin_config')
        .select('key, value')
        .in('key', ['free_generations_per_month', 'credits_per_generation']);

      if (rowErr) {
        // Table not found yet
        return { free_generations_per_month: '3', credits_per_generation: '1' } as AdminConfig;
      }

      const configMap = (rows ?? []).reduce((acc: Record<string, string>, row: { key: string; value: string }) => {
        acc[row.key] = row.value;
        return acc;
      }, {});

      return {
        free_generations_per_month: configMap['free_generations_per_month'] ?? '3',
        credits_per_generation: configMap['credits_per_generation'] ?? '1',
      } as AdminConfig;
    },
    staleTime: 60 * 1000,
  });
}

// ─── Admin: Update config ─────────────────────────────────────────────────────
export function useUpdateAdminConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<AdminConfig>) => {
      const { data, error } = await supabase.functions.invoke('admin-config', {
        method: 'PUT',
        body: updates,
      });

      if (error) {
        // Fallback: direct upsert to admin_config table
        const upserts = Object.entries(updates).map(([key, value]) => ({
          key,
          value: String(value),
          updated_at: new Date().toISOString(),
        }));

        for (const upsert of upserts) {
          const { error: upsertErr } = await supabase
            .from('admin_config')
            .upsert(upsert, { onConflict: 'key' });
          if (upsertErr) throw new Error(upsertErr.message);
        }
        return { success: true };
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'config'] });
      toast.success('Config updated — changes apply immediately');
    },
    onError: (error: Error) => {
      toast.error('Failed to update config', { description: error.message });
    },
  });
}
