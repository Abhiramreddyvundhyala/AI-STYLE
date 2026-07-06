/**
 * Generate HD Edge Function
 * Generates full-quality HD image after purchase verification.
 * Uses the same surgical prompt approach as generate-universal.
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
    const { styleId, userImageUrl, userId, purchaseId } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify purchase belongs to this user
    const { data: purchase, error: purchaseError } = await supabaseClient
      .from('purchases')
      .select('id')
      .eq('id', purchaseId)
      .eq('buyer_id', userId)
      .eq('style_id', styleId)
      .single();

    if (purchaseError || !purchase) {
      throw new Error('Purchase not found or unauthorized');
    }

    // Fetch style image only — we don't need the prompt text
    const { data: style, error: styleError } = await supabaseClient
      .from('styles')
      .select('sample_image_url')
      .eq('id', styleId)
      .single();

    if (styleError || !style?.sample_image_url) {
      throw new Error('Style not found or missing image');
    }

    // Build minimal surgical prompt — same philosophy as generate-universal
    const prompt = userImageUrl
      ? `Image 1 is the style template. Image 2 is the face reference. Replace only the face in Image 1 with the person from Image 2. Match their exact facial features, skin tone, and identity to the lighting and angle in Image 1. Change nothing else — preserve the full composition, clothing, background, text, and all other elements exactly.`
      : `Recreate Image 1 with maximum fidelity. Preserve every detail: composition, faces, clothing, text, colors, lighting, and background. Do not change anything.`;

    // Generate HD image via OpenAI
    const hdImageUrl = await generateHD(prompt, style.sample_image_url, userImageUrl);

    // Store HD URL on the purchase record
    await supabaseClient
      .from('purchases')
      .update({ hd_image_url: hdImageUrl })
      .eq('id', purchaseId);

    return new Response(
      JSON.stringify({ hdUrl: hdImageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('HD generation error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

async function generateHD(
  prompt: string,
  styleImageUrl: string,
  userImageUrl?: string
): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('GPT_IMAGE_API_KEY');
  if (!apiKey) throw new Error('OpenAI API key not configured');

  async function urlToBlob(url: string): Promise<Blob> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    return res.blob();
  }

  const formData = new FormData();
  formData.append('model', 'gpt-image-2');
  formData.append('prompt', prompt);
  formData.append('n', '1');
  formData.append('size', '1024x1024');

  // Send style image (+ optional face reference)
  const styleBlob = await urlToBlob(styleImageUrl);
  if (userImageUrl) {
    const faceBlob = await urlToBlob(userImageUrl);
    formData.append('image[]', styleBlob, 'style_template.png');
    formData.append('image[]', faceBlob, 'face_reference.png');
  } else {
    formData.append('image', styleBlob, 'style_template.png');
  }

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('OpenAI HD error:', response.status, err);
    throw new Error(`OpenAI API error (${response.status}): ${err}`);
  }

  const result = await response.json();
  if (result.data?.[0]?.url) return result.data[0].url;
  if (result.data?.[0]?.b64_json) return `data:image/png;base64,${result.data[0].b64_json}`;
  throw new Error('No image URL or base64 in OpenAI response');
}
