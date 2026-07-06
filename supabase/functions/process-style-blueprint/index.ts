/**
 * Process Style Blueprint — DEPRECATED
 * The blueprint system was superseded by direct visual reference generation.
 * generate-universal sends the style image directly to gpt-image-2 /images/edits
 * which uses the image as a visual template — no separate blueprint analysis needed.
 * This eliminated ~2,000 tokens of Vision AI analysis per style upload.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return new Response(JSON.stringify({ error: 'Deprecated. Style analysis is handled by generate-universal using direct image reference.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 410 });
});
