/**
 * Extract Face — DEPRECATED
 * This endpoint used a placeholder Replicate model that was never a real model ID.
 * Face matching is handled natively by gpt-image-2 /images/edits which accepts
 * two images and performs face preservation automatically — no pre-extraction needed.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return new Response(JSON.stringify({ error: 'Deprecated. gpt-image-2 handles face matching natively via dual image input.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 410 });
});
