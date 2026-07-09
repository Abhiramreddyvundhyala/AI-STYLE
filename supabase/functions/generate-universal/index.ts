/**
 * Universal Image Generation Edge Function
 * Supports ALL AI models with face matching and encrypted prompts
 * 
 * Supported Models:
 * - Google: Nanobanana 2, Nanobanana Pro
 * - OpenAI: GPT Image 2.0 (DALL-E 3)
 * - ByteDance: Seedream 5.0 Lite, Seedream 4.5
 * - Midjourney: V8.1
 * - Black Forest Labs: Flux 2 Klein
 * - Z Image: Z Image Turbo
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '../_shared/rateLimiter.ts';



const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Expected POST, got ' + req.method }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    );
  }

  try {
    // ── AUTH: Verify JWT — REQUIRED. No anonymous access. ───────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required', code: 'AUTH_REQUIRED' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: invalid or expired token', code: 'INVALID_TOKEN' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // ── RATE LIMIT: 5 generations per minute per user ────────────────────────
    const rateLimit = await checkRateLimit(
      adminClient,
      user.id,
      'generate-universal',
      RATE_LIMITS['generate-universal']
    );
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetAt, corsHeaders);
    }

    // ── CREDIT CHECK: deduct 1 credit before starting (free first, then paid) ──
    const { data: creditType, error: creditError } = await adminClient.rpc('deduct_credit', {
      p_user_id: user.id,
    });

    if (creditError) {
      const msg = creditError.message ?? '';
      if (msg.includes('INSUFFICIENT_CREDITS')) {
        return new Response(
          JSON.stringify({
            error: 'You have no credits remaining. Purchase a credit pack to continue generating.',
            code: 'INSUFFICIENT_CREDITS',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 402 }
        );
      }
      console.error('Credit deduction error:', creditError);
      throw new Error('Failed to process credit');
    }

    let body: Record<string, unknown>;
    try {
      const text = await req.text();
      if (!text || text.length === 0) throw new Error('Empty request body');
      body = JSON.parse(text);
    } catch (jsonError: unknown) {
      const msg = jsonError instanceof Error ? jsonError.message : String(jsonError);
      console.error('JSON parse error:', msg);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body', details: msg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const {
      modelId,
      styleId,
      userImageUrl,
      faceEmbedding,
      preserveFaceStrength = 1.0,
      width,
      height,
      textModifications,
    } = body as {
      modelId: string;
      styleId: string;
      userImageUrl?: string;
      faceEmbedding?: number[];
      preserveFaceStrength?: number;
      width?: number;
      height?: number;
      textModifications?: string;
    };

    if (!modelId) throw new Error('Missing modelId parameter');
    if (!styleId) throw new Error('Missing styleId parameter');

    // ── Create job record — include user_id for RLS ────────────────────────
    const supabase = adminClient;
    const { data: job, error: jobError } = await supabase
      .from('generation_jobs')
      .insert({ status: 'pending', model_id: modelId, style_id: styleId, user_id: user.id })
      .select('id')
      .single();

    if (jobError || !job) {
      console.error('❌ Failed to create job:', jobError);
      throw new Error('Failed to create generation job');
    }

    const jobId = job.id as string;

    // ── Return jobId immediately — don't wait for OpenAI ───────────────────
    // EdgeRuntime.waitUntil() lets the background task continue after response is sent.
    EdgeRuntime.waitUntil(
      runGenerationJob(jobId, user.id, (creditType as string) ?? 'free', {
        modelId,
        styleId,
        userImageUrl,
        faceEmbedding,
        preserveFaceStrength,
        width,
        height,
        textModifications,
      })
    );

    return new Response(
      JSON.stringify({
        jobId,
        status: 'pending',
        message: 'Generation started. Poll /get-job-status for result.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Handler error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

// ── Background job processor ────────────────────────────────────────────────
async function runGenerationJob(
  jobId: string,
  userId: string,
  creditType: string,
  params: {
    modelId: string;
    styleId: string;
    userImageUrl?: string;
    faceEmbedding?: number[];
    preserveFaceStrength?: number;
    width?: number;
    height?: number;
    textModifications?: string;
  }
): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const markFailed = async (msg: string) => {
    // Refund the credit so the user doesn't lose it on error
    try {
      await supabase.rpc('refund_credit', { p_user_id: userId, p_credit_type: creditType });
    } catch (refundErr) {
      console.error('Failed to refund credit for job', jobId, refundErr);
    }
    await supabase
      .from('generation_jobs')
      .update({ status: 'failed', error: msg })
      .eq('id', jobId);
    console.error('📕 Job failed:', jobId, msg);
  };

  try {
    await supabase
      .from('generation_jobs')
      .update({ status: 'processing' })
      .eq('id', jobId);

    const {
      modelId, styleId, userImageUrl, faceEmbedding,
      preserveFaceStrength = 1.0, width, height, textModifications,
    } = params;

    const startTime = Date.now();

    // ── Fetch style from DB ────────────────────────────────────────────────
    const { data: styleData, error: styleError } = await supabase
      .from('styles')
      .select('sample_image_url, title')
      .eq('id', styleId)
      .single();

    if (styleError || !styleData) {
      await markFailed(`Could not fetch style: ${styleError?.message ?? 'not found'}`);
      return;
    }

    const styleImageUrl: string = styleData.sample_image_url || '';

    if (!styleImageUrl) {
      await markFailed('Style has no sample image. Cannot generate without a visual reference.');
      return;
    }

    // Build minimal surgical prompt — the image does the visual heavy lifting.
    // styleImageUrl is always present (validated above).
    const hasFace = !!userImageUrl;
    const hasText = !!(textModifications && textModifications.trim());
    let finalPrompt: string;

    if (hasFace && hasText) {
      // CASE D: Face swap + text change
      finalPrompt = `Image 1 is the style template. Image 2 is the face reference. Make exactly two edits to Image 1: (1) swap the face with the identity from Image 2, matching their skin tone and features naturally; (2) apply this text change: "${textModifications!.trim()}". Keep font, size, color, and placement identical. Change absolutely nothing else.`;
    } else if (hasFace) {
      // CASE B: Face swap only
      finalPrompt = `Image 1 is the style template. Image 2 is the face reference. Replace only the face in Image 1 with the person from Image 2. Match their exact facial features, skin tone, and identity to the lighting and angle in Image 1. Change nothing else — preserve the full composition, clothing, background, text, and all other elements exactly.`;
    } else if (hasText) {
      // CASE C: Text change only
      finalPrompt = `Recreate Image 1 exactly. Apply only this text change: "${textModifications!.trim()}". Keep the font, size, weight, color, and position identical to the original. Do not alter any people, faces, backgrounds, or other design elements.`;
    } else {
      // CASE A: Style recreation only
      finalPrompt = `Recreate Image 1 with maximum fidelity. Preserve every detail: composition, faces, clothing, text, colors, lighting, and background. Do not change anything.`;
    }

    if (!finalPrompt) {
      await markFailed('Could not build prompt.');
      return;
    }

    // ── Call AI model ──────────────────────────────────────────────────────
    let generatedImageUrl: string;

    switch (modelId) {
      case 'gpt-image-2':
        generatedImageUrl = await generateWithOpenAI(
          finalPrompt, styleImageUrl, userImageUrl, faceEmbedding, preserveFaceStrength, width, height
        );
        break;
      case 'nanobanana-2':
      case 'nanobanana-pro':
        generatedImageUrl = await generateWithGoogle(
          modelId, finalPrompt, userImageUrl, faceEmbedding, preserveFaceStrength, width, height
        );
        break;
      case 'seedream-5-lite':
      case 'seedream-4-5':
        generatedImageUrl = await generateWithByteDance(
          modelId, finalPrompt, userImageUrl, faceEmbedding, preserveFaceStrength, width, height
        );
        break;
      case 'midjourney-v8':
        generatedImageUrl = await generateWithMidjourney(
          finalPrompt, userImageUrl, faceEmbedding, preserveFaceStrength, width, height
        );
        break;
      case 'flux-2-klein':
        generatedImageUrl = await generateWithFlux(
          finalPrompt, userImageUrl, faceEmbedding, preserveFaceStrength, width, height
        );
        break;
      case 'z-image-turbo':
        generatedImageUrl = await generateWithZImage(
          finalPrompt, userImageUrl, faceEmbedding, preserveFaceStrength, width, height
        );
        break;
      default:
        await markFailed(`Unsupported model: ${modelId}`);
        return;
    }

    if (!generatedImageUrl) {
      await markFailed(`Model ${modelId} did not return an image URL`);
      return;
    }

    // ── Store result in Supabase Storage ────────────────────────────────────
    let storedUrl = generatedImageUrl;
    try {
      storedUrl = await storeImageInSupabase(generatedImageUrl);
    } catch {
      console.warn('Storage failed for job', jobId, '— using original URL');
    }

    const processingTime = Date.now() - startTime;
    console.log('✅ [Job', jobId, '] Completed in', processingTime, 'ms');

    await supabase
      .from('generation_jobs')
      .update({ status: 'completed', result_url: storedUrl })
      .eq('id', jobId);

    // ── Log to generation_history for the user's history tab ────────────
    await supabase
      .from('generation_history')
      .insert({
        user_id: userId,
        style_id: styleId,
        image_url: storedUrl,
        credit_type: creditType,
        credits_used: 1,
        status: 'success',
        metadata: { model_id: modelId, processing_time_ms: processingTime },
      })
      .select()
      .single(); // ignore error — history log is non-critical


  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await markFailed(msg);
  }
}

/**
 * Decrypt encrypted prompt using server-side key
 */
async function decryptPrompt(encryptedPrompt: string): Promise<string> {
  const encryptionKey = Deno.env.get('ENCRYPTION_SECRET_KEY');
  if (!encryptionKey) {
    throw new Error('Encryption key not configured');
  }

  try {
    const combined = Uint8Array.from(atob(encryptedPrompt), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const encoder = new TextEncoder();
    const keyData = encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32));
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch {
    throw new Error('Decryption failed');
  }
}

/**
 * Store a generated image in Supabase Storage for persistence
 * Handles both URL-based images and base64 data URLs
 */
async function storeImageInSupabase(imageUrl: string): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase credentials not configured for storage');
  }

  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  const fileName = `generated/${Date.now()}-${crypto.randomUUID()}.png`;

  let imageBlob: Blob;

  if (imageUrl.startsWith('data:')) {
    // Use Deno's native fetch() for reliable data URL → blob conversion
    // This avoids the buggy manual atob() + charCodeAt() loop
    const dataUrlResponse = await fetch(imageUrl);
    imageBlob = await dataUrlResponse.blob();
  } else {
    // Fetch image from URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch generated image: ${response.status}`);
    }
    imageBlob = await response.blob();
  }

  // Upload to Supabase Storage
  const { data, error } = await supabaseClient.storage
    .from('generated-images')
    .upload(fileName, imageBlob, {
      contentType: 'image/png',
      cacheControl: '31536000', // 1 year cache
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload to Supabase Storage: ${error.message}`);
  }

  // Get public URL
  const { data: publicUrlData } = supabaseClient.storage
    .from('generated-images')
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

// Prompt helpers removed — prompts are now built inline as minimal surgical instructions.

/**
 * Generate with OpenAI GPT Image 2
 * Uses v1/images/edits endpoint for image-to-image generation
 * This is the correct endpoint for GPT Image 2 with image inputs
 */
async function generateWithOpenAI(
  prompt: string,
  styleImageUrl: string | undefined,
  userImageUrl: string | undefined,
  faceEmbedding: number[] | undefined,
  preserveFaceStrength: number,
  width: number | undefined,
  height: number | undefined
): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('GPT_IMAGE_API_KEY');
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const requestStartTime = Date.now();

  try {
    async function urlToBlob(url: string): Promise<Blob> {
      const response = await fetch(url);
      return response.blob();
    }
    
    // Determine size
    let size = '1024x1024';
    if (width && height) {
      const aspectRatio = width / height;
      if (aspectRatio > 1.5) {
        size = '1792x1024';
      } else if (aspectRatio < 0.7) {
        size = '1024x1792';
      }
    }

    if (styleImageUrl) {
      const styleBlob = await urlToBlob(styleImageUrl);
      const formData = new FormData();
      formData.append('model', 'gpt-image-2');

      if (userImageUrl) {
        const userFaceBlob = await urlToBlob(userImageUrl);
        formData.append('image[]', styleBlob, 'style_template.png');
        formData.append('image[]', userFaceBlob, 'face_reference.png');
      } else {
        formData.append('image', styleBlob, 'style_template.png');
      }

      formData.append('prompt', prompt);
      formData.append('n', '1');
      formData.append('size', size);

      const editsResponse = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData,
      });

      if (!editsResponse.ok) {
        const errorText = await editsResponse.text();
        console.error('OpenAI edits error:', editsResponse.status, errorText);
        throw new Error(`OpenAI API error (${editsResponse.status}): ${errorText}`);
      }

      const editsResult = await editsResponse.json();
      if (editsResult.data?.[0]?.url) return editsResult.data[0].url;
      if (editsResult.data?.[0]?.b64_json) return `data:image/png;base64,${editsResult.data[0].b64_json}`;
      console.error('Unexpected OpenAI edits response:', JSON.stringify(editsResult).substring(0, 500));
      throw new Error('GPT Image 2 did not return image URL or base64 data');
      
    } else {
      // Use generations endpoint for text-only
      console.log('� Using GPT Image 2 generations endpoint');
      
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-2',
          prompt: prompt,
          n: 1,
          size: size,
          // gpt-image-2 only supports b64_json on /generations too
        }),
        // No AbortController — let the request run to natural completion
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI generations error:', response.status, errorText);
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      if (result.data?.[0]?.url) return result.data[0].url;
      if (result.data?.[0]?.b64_json) return `data:image/png;base64,${result.data[0].b64_json}`;
      console.error('Unexpected OpenAI generations response:', JSON.stringify(result).substring(0, 500));
      throw new Error('GPT Image 2 did not return image URL or base64 data');
    }

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('OpenAI generation failed after', Date.now() - requestStartTime, 'ms:', errMsg);
    throw new Error(`OpenAI generation failed: ${errMsg}`);
  }
}

/**
 * Generate with Google (Nanobanana models)
 */
async function generateWithGoogle(
  modelId: string,
  prompt: string,
  imageUrl: string | undefined,
  faceEmbedding: number[] | undefined,
  preserveFaceStrength: number,
  width: number | undefined,
  height: number | undefined
): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Google API key not configured');

  const modelName = modelId === 'nanobanana-pro' 
    ? 'gemini-3.1-pro-image-preview'
    : 'gemini-3.1-flash-image-preview';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            ...(imageUrl ? [{ inline_data: { mime_type: 'image/jpeg', data: await fetchImageAsBase64(imageUrl) } }] : []),
          ],
        }],
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
        },
      }),
    }
  );

  if (!response.ok) throw new Error('Google generation failed');

  const result = await response.json();
  // Extract image URL from response
  return result.candidates[0].content.parts[0].text;
}

/**
 * Generate with ByteDance (Seedream models)
 */
async function generateWithByteDance(
  modelId: string,
  prompt: string,
  imageUrl: string | undefined,
  faceEmbedding: number[] | undefined,
  preserveFaceStrength: number,
  width: number | undefined,
  height: number | undefined
): Promise<string> {
  const apiKey = Deno.env.get('BYTEDANCE_API_KEY');
  if (!apiKey) throw new Error('ByteDance API key not configured');

  const response = await fetch('https://api.bytedance.com/v1/images/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      prompt,
      image: imageUrl,
      face_embedding: faceEmbedding,
      face_strength: preserveFaceStrength,
      width,
      height,
    }),
  });

  if (!response.ok) throw new Error('ByteDance generation failed');

  const result = await response.json();
  return result.data.url;
}

/**
 * Generate with Midjourney
 */
async function generateWithMidjourney(
  prompt: string,
  imageUrl: string | undefined,
  faceEmbedding: number[] | undefined,
  preserveFaceStrength: number,
  width: number | undefined,
  height: number | undefined
): Promise<string> {
  const apiKey = Deno.env.get('MIDJOURNEY_API_KEY');
  if (!apiKey) throw new Error('Midjourney API key not configured');

  // Calculate aspect ratio if dimensions provided
  let aspectRatio = '1:1'; // default
  if (width && height) {
    const ratio = width / height;
    if (ratio > 1.5) aspectRatio = '16:9';
    else if (ratio < 0.7) aspectRatio = '9:16';
  }

  const response = await fetch('https://api.midjourney.com/v1/imagine', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_url: imageUrl,
      face_preservation: preserveFaceStrength,
      aspect_ratio: aspectRatio,
    }),
  });

  if (!response.ok) throw new Error('Midjourney generation failed');

  const result = await response.json();
  return result.image_url;
}

/**
 * Generate with Flux (Black Forest Labs)
 */
async function generateWithFlux(
  prompt: string,
  imageUrl: string | undefined,
  faceEmbedding: number[] | undefined,
  preserveFaceStrength: number,
  width: number | undefined,
  height: number | undefined
): Promise<string> {
  const apiKey = Deno.env.get('REPLICATE_API_TOKEN');
  if (!apiKey) throw new Error('Replicate API key not configured');

  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'flux-2-klein-version-id', // Replace with actual version
      input: {
        prompt,
        image: imageUrl,
        face_embedding: faceEmbedding,
        face_strength: preserveFaceStrength,
        width: width || 1024,
        height: height || 1024,
      },
    }),
  });

  if (!response.ok) throw new Error('Flux generation failed');

  const prediction = await response.json();
  return await pollReplicate(apiKey, prediction.id);
}

/**
 * Generate with Z Image Turbo
 */
async function generateWithZImage(
  prompt: string,
  imageUrl: string | undefined,
  faceEmbedding: number[] | undefined,
  preserveFaceStrength: number,
  width: number | undefined,
  height: number | undefined
): Promise<string> {
  const apiKey = Deno.env.get('ZIMAGE_API_KEY');
  if (!apiKey) throw new Error('Z Image API key not configured');

  const response = await fetch('https://api.zimage.ai/v1/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'z-image-turbo',
      prompt,
      reference_image: imageUrl,
      face_preservation: preserveFaceStrength,
      width: width || 1024,
      height: height || 1024,
    }),
  });

  if (!response.ok) throw new Error('Z Image generation failed');

  const result = await response.json();
  return result.image_url;
}

/**
 * Poll Replicate prediction
 */
async function pollReplicate(apiKey: string, predictionId: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: { 'Authorization': `Token ${apiKey}` },
      }
    );

    const result = await response.json();

    if (result.status === 'succeeded') {
      return result.output[0];
    }

    if (result.status === 'failed') {
      throw new Error('Generation failed');
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    attempts++;
  }

  throw new Error('Generation timeout');
}

/**
 * Verify face match between original and generated images
 */
async function verifyFaceMatch(
  originalImageUrl: string,
  generatedImageUrl: string
): Promise<number> {
  try {
    const apiKey = Deno.env.get('REPLICATE_API_TOKEN');
    if (!apiKey) return 0;

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'face-comparison-model-version',
        input: {
          image1: originalImageUrl,
          image2: generatedImageUrl,
        },
      }),
    });

    if (!response.ok) return 0;

    const prediction = await response.json();
    const result = await pollReplicate(apiKey, prediction.id);
    
    return parseFloat(result) * 100;
  } catch {
    return 0;
  }
}

/**
 * Fetch image and convert to base64
 */
async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return base64;
}
