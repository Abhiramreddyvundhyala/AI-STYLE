/**
 * Admin Packages CRUD — Supabase Edge Function
 *
 * Requires: JWT claim role = 'admin'
 *
 * GET    /functions/v1/admin-packages         → List all packages
 * POST   /functions/v1/admin-packages         → Create package
 * PUT    /functions/v1/admin-packages/:id     → Update package
 * DELETE /functions/v1/admin-packages/:id     → Deactivate package
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Extract admin user from JWT. Checks for role = 'admin' in the claims.
 */
async function getAdminUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;

  // Check role from JWT claims (set by custom_access_token_hook Postgres function)
  // The JWT is decoded by the Supabase client; we check app_metadata or user_metadata
  // Since we use a custom hook, the claim is in the JWT directly
  // We verify this by checking the admin_users table directly as a secondary check
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: adminRecord } = await adminClient
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single();

  if (!adminRecord) return null;

  return { user, adminClient };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) =>
    console.log(`[admin-packages][${requestId}] ${msg}`, data ?? '');

  try {
    // ── 1. Admin auth check ─────────────────────────────────────────────────
    const admin = await getAdminUser(req);
    if (!admin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { adminClient } = admin;
    const url = new URL(req.url);

    // Extract package ID from path if present (e.g., /admin-packages/uuid)
    const pathParts = url.pathname.split('/').filter(Boolean);
    const packageId = pathParts[pathParts.length - 1] !== 'admin-packages'
      ? pathParts[pathParts.length - 1]
      : null;

    // ── GET: List all packages ──────────────────────────────────────────────
    if (req.method === 'GET') {
      const { data: packages, error } = await adminClient
        .from('packages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch packages', code: 'DB_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ data: packages }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── POST: Create package ────────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = await req.json();
      const { name, credits, price_inr, price_usd } = body;

      if (!name || !credits || !price_inr || !price_usd) {
        return new Response(
          JSON.stringify({ error: 'name, credits, price_inr, price_usd are required', code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: pkg, error } = await adminClient
        .from('packages')
        .insert({ name, credits: parseInt(credits), price_inr: parseFloat(price_inr), price_usd: parseFloat(price_usd), is_active: true })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to create package', code: 'DB_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      log('Package created', pkg.id);
      return new Response(
        JSON.stringify({ data: pkg }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── PUT: Update package ─────────────────────────────────────────────────
    if (req.method === 'PUT' && packageId) {
      const body = await req.json();
      const { name, credits, price_inr, price_usd, is_active } = body;

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (credits !== undefined) updateData.credits = parseInt(credits);
      if (price_inr !== undefined) updateData.price_inr = parseFloat(price_inr);
      if (price_usd !== undefined) updateData.price_usd = parseFloat(price_usd);
      if (is_active !== undefined) updateData.is_active = is_active;

      const { data: pkg, error } = await adminClient
        .from('packages')
        .update(updateData)
        .eq('id', packageId)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to update package', code: 'DB_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      log('Package updated', packageId);
      return new Response(
        JSON.stringify({ data: pkg }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── DELETE: Deactivate package (soft delete) ────────────────────────────
    if (req.method === 'DELETE' && packageId) {
      const { data: pkg, error } = await adminClient
        .from('packages')
        .update({ is_active: false })
        .eq('id', packageId)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to deactivate package', code: 'DB_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      log('Package deactivated', packageId);
      return new Response(
        JSON.stringify({ data: pkg }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(`[admin-packages][${requestId}] Unhandled error:`, message);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
