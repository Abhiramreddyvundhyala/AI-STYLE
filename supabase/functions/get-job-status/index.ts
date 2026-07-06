/**
 * Get Job Status Edge Function
 * Fast polling endpoint — returns status of an async generation job.
 * Called every 3s by the frontend until status is 'completed' or 'failed'.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Missing jobId' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: job, error } = await supabase
      .from('generation_jobs')
      .select('id, status, result_url, error, created_at, updated_at')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    return new Response(
      JSON.stringify({
        jobId: job.id,
        status: job.status,            // 'pending' | 'processing' | 'completed' | 'failed'
        imageUrl: job.result_url,      // set when status = 'completed'
        error: job.error,              // set when status = 'failed'
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
