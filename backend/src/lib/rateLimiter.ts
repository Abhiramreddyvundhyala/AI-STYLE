/**
 * Rate limiter — Postgres-backed (mirrors the Deno edge function version)
 * No Redis required.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { Response as ExpressResponse } from 'express';

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'create-order':          { maxRequests: 10, windowSeconds: 60 },
  'verify-payment':        { maxRequests: 10, windowSeconds: 60 },
  'generate-universal':    { maxRequests: 5,  windowSeconds: 60 },
  'style-purchase':        { maxRequests: 10, windowSeconds: 60 },
  'verify-style-purchase': { maxRequests: 10, windowSeconds: 60 },
  'generate':              { maxRequests: 60, windowSeconds: 60 },
};

export async function checkRateLimit(
  client: SupabaseClient,
  userId: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now = new Date();
  const windowMs = config.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const resetAt = new Date(windowStart.getTime() + windowMs);

  try {
    const key = `user:${userId}:${endpoint}`;

    const { data: existing, error: selectErr } = await client
      .from('rate_limits')
      .select('id, request_count')
      .eq('key', key)
      .eq('window_start', windowStart.toISOString())
      .single();

    if (selectErr && (selectErr.code === '42P01' || selectErr.message?.includes('does not exist'))) {
      return { allowed: true, remaining: config.maxRequests, resetAt };
    }

    let currentCount: number;

    if (existing) {
      const { data: updated } = await client
        .from('rate_limits')
        .update({ request_count: existing.request_count + 1 })
        .eq('id', existing.id)
        .select('request_count')
        .single();
      currentCount = updated?.request_count ?? existing.request_count + 1;
    } else {
      const { error } = await client
        .from('rate_limits')
        .insert({ key, window_start: windowStart.toISOString(), request_count: 1 });

      if (error && error.code === '23505') {
        const { data: raceData } = await client
          .from('rate_limits')
          .select('id, request_count')
          .eq('key', key)
          .eq('window_start', windowStart.toISOString())
          .single();
        if (raceData) {
          await client
            .from('rate_limits')
            .update({ request_count: raceData.request_count + 1 })
            .eq('id', raceData.id);
          currentCount = raceData.request_count + 1;
        } else {
          currentCount = 1;
        }
      } else if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        return { allowed: true, remaining: config.maxRequests, resetAt };
      } else {
        currentCount = 1;
      }
    }

    // Trigger cleanup async (fire-and-forget)
    void client.rpc('cleanup_rate_limits');

    const allowed = currentCount <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - currentCount);
    return { allowed, remaining, resetAt };
  } catch (_err) {
    console.warn('[rateLimiter] Error, failing open:', _err);
    return { allowed: true, remaining: config.maxRequests, resetAt };
  }
}

/**
 * Send a 429 Too Many Requests response
 */
export function sendRateLimitResponse(res: ExpressResponse, resetAt: Date): void {
  const retryAfter = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
  res.set({
    'Retry-After': String(retryAfter),
    'X-RateLimit-Reset': resetAt.toISOString(),
  });
  res.status(429).json({
    error: 'Too many requests. Please slow down and try again.',
    code: 'RATE_LIMITED',
    retry_after: retryAfter,
  });
}
