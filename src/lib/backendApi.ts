/**
 * backendApi — Fetch wrapper for the Render backend
 *
 * Automatically attaches the Supabase JWT (Authorization header) to every request.
 * Base URL comes from VITE_BACKEND_URL env var.
 *
 * Usage:
 *   const data = await backendApi.post('generate-universal', { modelId, styleId });
 *   const data = await backendApi.get('credits/balance');
 */

import { supabase } from './supabase';

const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, '')
  ?? 'https://ai-style-im28.onrender.com';

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return `Bearer ${session.access_token}`;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const authHeader = await getAuthHeader();
  const url = `${BASE_URL}/${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const json = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));

  if (!response.ok) {
    const message = (json as { error?: string })?.error ?? `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return json as T;
}

export const backendApi = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
