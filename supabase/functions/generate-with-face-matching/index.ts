/**
 * Generate with Face Matching — DEPRECATED
 * This endpoint is superseded by generate-universal which handles all models,
 * all cases (face/text/both), and uses the async job queue.
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
      status: 410,
    }
  );
});
