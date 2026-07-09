-- =============================================================================
-- Security Hardening v2 (idempotent — safe to re-run)
-- Run AFTER 20260705_security_hardening.sql
-- =============================================================================

-- ─── FIX C3: generated-images bucket must be PRIVATE ─────────────────────────
-- NOTE: You MUST also set the bucket to "Private" in the Supabase Storage UI.
-- These policies ensure only the image owner can read their results.

-- ─── FIX M1: Block frontend-direct inserts to generation_history ─────────────
-- generation_history should ONLY be written by the backend (service role).
DROP POLICY IF EXISTS "Users can insert own generation history" ON public.generation_history;
DROP POLICY IF EXISTS "Authenticated insert generation_history"  ON public.generation_history;

REVOKE INSERT ON public.generation_history FROM authenticated;
REVOKE INSERT ON public.generation_history FROM anon;
REVOKE UPDATE ON public.generation_history FROM authenticated;
REVOKE UPDATE ON public.generation_history FROM anon;
REVOKE DELETE ON public.generation_history FROM authenticated;
REVOKE DELETE ON public.generation_history FROM anon;

-- ─── FIX: Ensure generation_history SELECT is user-scoped ────────────────────
DROP POLICY IF EXISTS "Users can read own generation history" ON public.generation_history;

CREATE POLICY "Users can read own generation history"
  ON public.generation_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── NOTE: sellers table already exists with correct schema ──────────────────
-- The sellers table uses `id UUID PRIMARY KEY REFERENCES auth.users(id)`.
-- RLS is already enabled. We only need to harden existing policies.

-- Ensure sellers RLS is enabled
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

-- ─── Storage: Object-level RLS for user-uploads (PRIVATE bucket) ─────────────
-- Users can only access files under their own user_id/ prefix.
-- This prevents one user from reading another user's face photos.

DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can read own uploads" ON storage.objects;
CREATE POLICY "Users can read own uploads"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own uploads" ON storage.objects;
CREATE POLICY "Users can delete own uploads"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── Storage: style-images (PUBLIC bucket — marketplace thumbnails) ───────────
DROP POLICY IF EXISTS "Anyone can view style images" ON storage.objects;
CREATE POLICY "Anyone can view style images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'style-images');

DROP POLICY IF EXISTS "Authenticated users can upload style images" ON storage.objects;
CREATE POLICY "Authenticated users can upload style images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'style-images');

-- ─── Storage: generated-images (PRIVATE bucket — user-scoped access) ─────────
-- Backend stores results at generated-images/{user_id}/{job_id}.png
-- Only the owning user can read their generated image.
DROP POLICY IF EXISTS "Users can view own generated images" ON storage.objects;
CREATE POLICY "Users can view own generated images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'generated-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
