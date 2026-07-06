/**
 * Lightweight Postgres-based Rate Limiter
 * Uses the rate_limits table for per-user, per-endpoint limiting.
 * No Redis required — works within Supabase Edge Functions.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window duration in seconds */
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

/**
 * Checks if the request is within rate limit.
 * Returns true if allowed, false if rate limited.
 *
 * Strategy: Each window_start is truncated to the minute boundary.
 * We upsert a record for (key, window_start) and check the count.
 */
export async function checkRateLimit(
  adminClient: SupabaseClient,
  userId: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now = new Date();
  const windowMs = config.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const resetAt = new Date(windowStart.getTime() + windowMs);

  // Fail-open: if rate_limits table doesn't exist or any DB error, allow the request
  try {
    const key = `user:${userId}:${endpoint}`;

    const { data: existing, error: selectErr } = await adminClient
      .from('rate_limits')
      .select('id, request_count')
      .eq('key', key)
      .eq('window_start', windowStart.toISOString())
      .single();

    // If table doesn't exist, fail-open
    if (selectErr && (selectErr.code === '42P01' || selectErr.message?.includes('does not exist'))) {
      return { allowed: true, remaining: config.maxRequests, resetAt };
    }

    let currentCount: number;

    if (existing) {
      const { data: updated } = await adminClient
        .from('rate_limits')
        .update({ request_count: existing.request_count + 1 })
        .eq('id', existing.id)
        .select('request_count')
        .single();
      currentCount = updated?.request_count ?? existing.request_count + 1;
    } else {
      const { error } = await adminClient
        .from('rate_limits')
        .insert({ key, window_start: windowStart.toISOString(), request_count: 1 });

      if (error && error.code === '23505') {
        const { data: raceData } = await adminClient
          .from('rate_limits')
          .select('id, request_count')
          .eq('key', key)
          .eq('window_start', windowStart.toISOString())
          .single();
        if (raceData) {
          await adminClient
            .from('rate_limits')
            .update({ request_count: raceData.request_count + 1 })
            .eq('id', raceData.id);
          currentCount = raceData.request_count + 1;
        } else {
          currentCount = 1;
        }
      } else if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        // Table doesn't exist — fail-open
        return { allowed: true, remaining: config.maxRequests, resetAt };
      } else {
        currentCount = 1;
      }
    }

    const allowed = currentCount <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - currentCount);

    adminClient.rpc('cleanup_rate_limits').then(() => {}).catch(() => {});

    return { allowed, remaining, resetAt };
  } catch (_err) {
    // Any unexpected error — fail-open so the main request isn't blocked
    console.warn('[rateLimiter] Error checking rate limit, failing open:', _err);
    return { allowed: true, remaining: config.maxRequests, resetAt };
  }
}

/**
 * Returns a rate-limited Response (429) with appropriate headers.
 */
export function rateLimitResponse(resetAt: Date, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please slow down and try again.',
      code: 'RATE_LIMITED',
      retry_after: Math.ceil((resetAt.getTime() - Date.now()) / 1000),
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
        'X-RateLimit-Reset': resetAt.toISOString(),
      },
    }
  );
}
