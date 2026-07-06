/**
 * Generate Preview Edge Function — DEPRECATED
 * This endpoint is no longer the primary generation path.
 * All generation now goes through generate-universal with job-queue polling.
 * This stub is kept so any stale callers get a helpful error instead of 404.
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
      error: 'This endpoint is deprecated. Use generate-universal instead.',
      migrate: 'POST /functions/v1/generate-universal with { modelId, styleId, userImageUrl, textModifications }',
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 410, // 410 Gone
    }
  );
});
