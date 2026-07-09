/**
 * generate-universal route
 * Port of supabase/functions/generate-universal/index.ts → Express
 *
 * POST /generate-universal
 * Auth required. Queues a background generation job and returns jobId.
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { adminClient } from '../lib/supabase';
import { checkRateLimit, RATE_LIMITS, sendRateLimitResponse } from '../lib/rateLimiter';

const router = Router();

router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const requestId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) =>
    console.log(`[generate-universal][${requestId}] ${msg}`, data ?? '');

  try {
    // ── Rate limit ────────────────────────────────────────────────────────
    const rateLimit = await checkRateLimit(
      adminClient, user.id, 'generate-universal', RATE_LIMITS['generate-universal']
    );
    if (!rateLimit.allowed) {
      sendRateLimitResponse(res, rateLimit.resetAt);
      return;
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
    } = req.body as {
      modelId: string;
      styleId: string;
      userImageUrl?: string;
      faceEmbedding?: number[];
      preserveFaceStrength?: number;
      width?: number;
      height?: number;
      textModifications?: string;
    };

    // ── Input validation (H11 fix) ─────────────────────────────────────────
    // Allowlist of known model IDs — never pass arbitrary strings to AI APIs
    const ALLOWED_MODEL_IDS = ['gpt-image-2', 'gemini-imagen-4-ultra', 'replicate-sdxl', 'default'];
    if (!modelId || !ALLOWED_MODEL_IDS.includes(modelId)) {
      res.status(400).json({ error: 'Invalid or missing modelId', code: 'VALIDATION_ERROR' });
      return;
    }

    // styleId must be a valid UUID
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!styleId || !UUID_RE.test(styleId)) {
      res.status(400).json({ error: 'Invalid or missing styleId', code: 'VALIDATION_ERROR' });
      return;
    }

    // Width and height must be reasonable integers if provided
    if (width !== undefined && (typeof width !== 'number' || !Number.isInteger(width) || width < 256 || width > 2048)) {
      res.status(400).json({ error: 'Invalid width (must be 256–2048)', code: 'VALIDATION_ERROR' });
      return;
    }
    if (height !== undefined && (typeof height !== 'number' || !Number.isInteger(height) || height < 256 || height > 2048)) {
      res.status(400).json({ error: 'Invalid height (must be 256–2048)', code: 'VALIDATION_ERROR' });
      return;
    }

    // Text modifications length limit
    if (textModifications && (typeof textModifications !== 'string' || textModifications.length > 500)) {
      res.status(400).json({ error: 'textModifications must be ≤500 characters', code: 'VALIDATION_ERROR' });
      return;
    }

    // userImageUrl basic safety check (must be a URL if provided)
    if (userImageUrl && typeof userImageUrl !== 'string') {
      res.status(400).json({ error: 'Invalid userImageUrl', code: 'VALIDATION_ERROR' });
      return;
    }


    // ── CREDIT CHECK: deduct 1 credit before starting ────────────────────────────
    const { data: creditType, error: creditError } = await adminClient.rpc('deduct_credit', {
      p_user_id: user.id,
    });
    if (creditError) {
      const msg = creditError.message ?? '';
      if (msg.includes('INSUFFICIENT_CREDITS')) {
        res.status(402).json({
          error: 'You have no credits remaining. Purchase a credit pack to continue generating.',
          code: 'INSUFFICIENT_CREDITS',
        });
        return;
      }
      log('Credit deduction error', creditError);
      res.status(500).json({ error: 'Failed to process credit' });
      return;
    }

    // ── Create generation job record ───────────────────────────────────────
    const { data: job, error: jobError } = await adminClient
      .from('generation_jobs')
      .insert({ status: 'pending', model_id: modelId, style_id: styleId, user_id: user.id })
      .select('id')
      .single();

    if (jobError || !job) {
      // Refund credit — job never started
      await adminClient.rpc('refund_credit', { p_user_id: user.id, p_credit_type: creditType });
      log('Failed to create job', jobError);
      res.status(500).json({ error: 'Failed to create generation job' });
      return;
    }

    const jobId = job.id as string;
    log('Job created', jobId);

    // ── Return jobId immediately, run generation in background ────────────────
    res.status(202).json({
      jobId,
      status: 'pending',
      message: 'Generation started. Poll /get-job-status for result.',
    });

    // Background processing (non-blocking)
    runGenerationJob(jobId, user.id, (creditType as string) ?? 'free', {
      modelId, styleId, userImageUrl, faceEmbedding,
      preserveFaceStrength, width, height, textModifications,
    }).catch((err) => {
      console.error(`[generate-universal] Background job ${jobId} threw:`, err);
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('Handler error', msg);
    if (!res.headersSent) res.status(400).json({ error: msg });
  }
});

// ── Background job processor ─────────────────────────────────────────────
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
  const markFailed = async (msg: string) => {
    // Refund credit on failure so user doesn't lose it
    try {
      await adminClient.rpc('refund_credit', { p_user_id: userId, p_credit_type: creditType });
    } catch (refundErr) {
      console.error('Failed to refund credit for job', jobId, refundErr);
    }
    await adminClient.from('generation_jobs').update({ status: 'failed', error: msg }).eq('id', jobId);
    console.error('📕 Job failed:', jobId, msg);
  };

  try {
    await adminClient.from('generation_jobs').update({ status: 'processing' }).eq('id', jobId);

    const { modelId, styleId, userImageUrl, faceEmbedding, preserveFaceStrength = 1.0, width, height, textModifications } = params;
    const startTime = Date.now();

    // Fetch style from DB
    const { data: styleData, error: styleError } = await adminClient
      .from('styles').select('sample_image_url, title').eq('id', styleId).single();
    if (styleError || !styleData) { await markFailed(`Could not fetch style: ${styleError?.message ?? 'not found'}`); return; }

    const styleImageUrl: string = styleData.sample_image_url || '';
    if (!styleImageUrl) { await markFailed('Style has no sample image.'); return; }

    // Build prompt
    const hasFace = !!userImageUrl;
    const hasText = !!(textModifications && textModifications.trim());
    let finalPrompt: string;

    if (hasFace && hasText) {
      finalPrompt = `Image 1 is the style template. Image 2 is the face reference. Make exactly two edits to Image 1: (1) swap the face with the identity from Image 2, matching their skin tone and features naturally; (2) apply this text change: "${textModifications!.trim()}". Keep font, size, color, and placement identical. Change absolutely nothing else.`;
    } else if (hasFace) {
      finalPrompt = `Image 1 is the style template. Image 2 is the face reference. Replace only the face in Image 1 with the person from Image 2. Match their exact facial features, skin tone, and identity to the lighting and angle in Image 1. Change nothing else — preserve the full composition, clothing, background, text, and all other elements exactly.`;
    } else if (hasText) {
      finalPrompt = `Recreate Image 1 exactly. Apply only this text change: "${textModifications!.trim()}". Keep the font, size, weight, color, and position identical to the original. Do not alter any people, faces, backgrounds, or other design elements.`;
    } else {
      finalPrompt = `Recreate Image 1 with maximum fidelity. Preserve every detail: composition, faces, clothing, text, colors, lighting, and background. Do not change anything.`;
    }

    // Call AI model
    let generatedImageUrl: string;
    switch (modelId) {
      case 'gpt-image-2':
        generatedImageUrl = await generateWithOpenAI(finalPrompt, styleImageUrl, userImageUrl, faceEmbedding, preserveFaceStrength, width, height);
        break;
      case 'nanobanana-2':
      case 'nanobanana-pro':
        generatedImageUrl = await generateWithGoogle(modelId, finalPrompt, userImageUrl, width, height);
        break;
      case 'seedream-5-lite':
      case 'seedream-4-5':
        generatedImageUrl = await generateWithByteDance(modelId, finalPrompt, userImageUrl, faceEmbedding, preserveFaceStrength, width, height);
        break;
      case 'midjourney-v8':
        generatedImageUrl = await generateWithMidjourney(finalPrompt, userImageUrl, preserveFaceStrength, width, height);
        break;
      case 'flux-2-klein':
        generatedImageUrl = await generateWithFlux(finalPrompt, userImageUrl, faceEmbedding, preserveFaceStrength, width, height);
        break;
      case 'z-image-turbo':
        generatedImageUrl = await generateWithZImage(finalPrompt, userImageUrl, preserveFaceStrength, width, height);
        break;
      default:
        await markFailed(`Unsupported model: ${modelId}`);
        return;
    }

    if (!generatedImageUrl) { await markFailed(`Model ${modelId} did not return an image URL`); return; }

    // Store in Supabase Storage
    let storedUrl = generatedImageUrl;
    try { storedUrl = await storeImageInSupabase(generatedImageUrl); }
    catch { console.warn('Storage failed for job', jobId, '— using original URL'); }

    console.log('✅ [Job', jobId, '] Completed in', Date.now() - startTime, 'ms');
    await adminClient.from('generation_jobs').update({ status: 'completed', result_url: storedUrl }).eq('id', jobId);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await markFailed(msg);
  }
}

async function urlToBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  return Buffer.from(await response.arrayBuffer());
}

async function generateWithOpenAI(
  prompt: string, styleImageUrl: string | undefined, userImageUrl: string | undefined,
  _faceEmbedding: number[] | undefined, _preserveFaceStrength: number,
  width: number | undefined, height: number | undefined
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.GPT_IMAGE_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  let size = '1024x1024';
  if (width && height) {
    const ratio = width / height;
    if (ratio > 1.5) size = '1792x1024';
    else if (ratio < 0.7) size = '1024x1792';
  }

  if (styleImageUrl) {
    const styleBuffer = await urlToBuffer(styleImageUrl);
    const formData = new globalThis.FormData();
    formData.append('model', 'gpt-image-2');

    if (userImageUrl) {
      const userBuffer = await urlToBuffer(userImageUrl);
      formData.append('image[]', new globalThis.Blob([styleBuffer], { type: 'image/png' }), 'style_template.png');
      formData.append('image[]', new globalThis.Blob([userBuffer], { type: 'image/png' }), 'face_reference.png');
    } else {
      formData.append('image', new globalThis.Blob([styleBuffer], { type: 'image/png' }), 'style_template.png');
    }
    formData.append('prompt', prompt);
    formData.append('n', '1');
    formData.append('size', size);

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) { const t = await response.text(); throw new Error(`OpenAI edits error (${response.status}): ${t}`); }
    const result = await response.json() as { data?: Array<{ url?: string; b64_json?: string }> };
    if (result.data?.[0]?.url) return result.data[0].url!;
    if (result.data?.[0]?.b64_json) return `data:image/png;base64,${result.data[0].b64_json}`;
    throw new Error('GPT Image 2 did not return image data');
  } else {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size }),
    });
    if (!response.ok) { const t = await response.text(); throw new Error(`OpenAI generations error (${response.status}): ${t}`); }
    const result = await response.json() as { data?: Array<{ url?: string; b64_json?: string }> };
    if (result.data?.[0]?.url) return result.data[0].url!;
    if (result.data?.[0]?.b64_json) return `data:image/png;base64,${result.data[0].b64_json}`;
    throw new Error('GPT Image 2 did not return image data');
  }
}

async function generateWithGoogle(
  modelId: string, prompt: string, imageUrl: string | undefined,
  _width: number | undefined, _height: number | undefined
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Google API key not configured');
  const modelName = modelId === 'nanobanana-pro' ? 'gemini-3.1-pro-image-preview' : 'gemini-3.1-flash-image-preview';

  let imageBase64: string | undefined;
  if (imageUrl) {
    const buf = await urlToBuffer(imageUrl);
    imageBase64 = buf.toString('base64');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, ...(imageBase64 ? [{ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }] : [])] }],
        generationConfig: { temperature: 0.9, topK: 40, topP: 0.95 },
      }),
    }
  );
  if (!response.ok) throw new Error('Google generation failed');
  const result = await response.json() as { candidates: Array<{ content: { parts: Array<{ text?: string }> } }> };
  return result.candidates[0].content.parts[0].text ?? '';
}

async function generateWithByteDance(
  modelId: string, prompt: string, imageUrl: string | undefined,
  faceEmbedding: number[] | undefined, preserveFaceStrength: number,
  width: number | undefined, height: number | undefined
): Promise<string> {
  const apiKey = process.env.BYTEDANCE_API_KEY;
  if (!apiKey) throw new Error('ByteDance API key not configured');
  const response = await fetch('https://api.bytedance.com/v1/images/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelId, prompt, image: imageUrl, face_embedding: faceEmbedding, face_strength: preserveFaceStrength, width, height }),
  });
  if (!response.ok) throw new Error('ByteDance generation failed');
  const result = await response.json() as { data: { url: string } };
  return result.data.url;
}

async function generateWithMidjourney(
  prompt: string, imageUrl: string | undefined, preserveFaceStrength: number,
  width: number | undefined, height: number | undefined
): Promise<string> {
  const apiKey = process.env.MIDJOURNEY_API_KEY;
  if (!apiKey) throw new Error('Midjourney API key not configured');
  let aspectRatio = '1:1';
  if (width && height) { const r = width / height; if (r > 1.5) aspectRatio = '16:9'; else if (r < 0.7) aspectRatio = '9:16'; }
  const response = await fetch('https://api.midjourney.com/v1/imagine', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_url: imageUrl, face_preservation: preserveFaceStrength, aspect_ratio: aspectRatio }),
  });
  if (!response.ok) throw new Error('Midjourney generation failed');
  const result = await response.json() as { image_url: string };
  return result.image_url;
}

async function generateWithFlux(
  prompt: string, imageUrl: string | undefined, faceEmbedding: number[] | undefined,
  preserveFaceStrength: number, width: number | undefined, height: number | undefined
): Promise<string> {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) throw new Error('Replicate API key not configured');
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: 'flux-2-klein-version-id', input: { prompt, image: imageUrl, face_embedding: faceEmbedding, face_strength: preserveFaceStrength, width: width || 1024, height: height || 1024 } }),
  });
  if (!response.ok) throw new Error('Flux generation failed');
  const prediction = await response.json() as { id: string };
  return pollReplicate(apiKey, prediction.id);
}

async function generateWithZImage(
  prompt: string, imageUrl: string | undefined, preserveFaceStrength: number,
  width: number | undefined, height: number | undefined
): Promise<string> {
  const apiKey = process.env.ZIMAGE_API_KEY;
  if (!apiKey) throw new Error('Z Image API key not configured');
  const response = await fetch('https://api.zimage.ai/v1/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'z-image-turbo', prompt, reference_image: imageUrl, face_preservation: preserveFaceStrength, width: width || 1024, height: height || 1024 }),
  });
  if (!response.ok) throw new Error('Z Image generation failed');
  const result = await response.json() as { image_url: string };
  return result.image_url;
}

async function pollReplicate(apiKey: string, predictionId: string): Promise<string> {
  for (let i = 0; i < 60; i++) {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, { headers: { Authorization: `Token ${apiKey}` } });
    const result = await response.json() as { status: string; output?: string[]; error?: string };
    if (result.status === 'succeeded') return result.output![0];
    if (result.status === 'failed') throw new Error(`Replicate prediction failed: ${result.error}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Generation timeout');
}

async function storeImageInSupabase(imageUrl: string): Promise<string> {
  const fileName = `generated/${Date.now()}-${crypto.randomUUID()}.png`;
  let imageBuffer: Buffer;

  if (imageUrl.startsWith('data:')) {
    const base64 = imageUrl.split(',')[1];
    imageBuffer = Buffer.from(base64, 'base64');
  } else {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    imageBuffer = Buffer.from(await response.arrayBuffer());
  }

  const { error } = await adminClient.storage
    .from('generated-images')
    .upload(fileName, imageBuffer, { contentType: 'image/png', cacheControl: '31536000', upsert: false });

  if (error) throw new Error(`Failed to upload: ${error.message}`);
  const { data } = adminClient.storage.from('generated-images').getPublicUrl(fileName);
  return data.publicUrl;
}

export default router;
