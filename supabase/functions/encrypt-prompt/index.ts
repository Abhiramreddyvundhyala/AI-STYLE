/**
 * Encrypt Prompt — DEPRECATED
 * Prompts are now stored as plain text in Supabase with RLS preventing
 * any client-side read. The edge function (service_role) reads them directly.
 * This endpoint is no longer part of the style creation flow.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: 'This endpoint is deprecated. Prompts are secured via Supabase RLS — no client-side encryption is needed.',
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 410,
    }
  );
});
