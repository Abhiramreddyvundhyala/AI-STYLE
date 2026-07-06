-- ============================================================================
-- Storage Buckets and Policies Migration
-- Run this in Supabase SQL Editor to create storage buckets
-- Safe to run multiple times - checks if things exist first
-- ============================================================================

-- ─── Create Storage Buckets ─────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('style-samples', 'style-samples', true),
  ('user-uploads', 'user-uploads', false),
  ('hd-outputs', 'hd-outputs', false)
ON CONFLICT (id) DO NOTHING;

-- ─── style-samples bucket policies ──────────────────────────────────────────
-- Public can view style samples
DROP POLICY IF EXISTS "Public can view style samples" ON storage.objects;
CREATE POLICY "Public can view style samples"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'style-samples');

-- Sellers can upload style samples
DROP POLICY IF EXISTS "Sellers can upload style samples" ON storage.objects;
CREATE POLICY "Sellers can upload style samples"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'style-samples' AND
    auth.uid() IN (SELECT id FROM sellers)
  );

-- Sellers can update their own samples
DROP POLICY IF EXISTS "Sellers can update their own samples" ON storage.objects;
CREATE POLICY "Sellers can update their own samples"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'style-samples' AND
    auth.uid() IN (SELECT id FROM sellers)
  );

-- Sellers can delete their own samples
DROP POLICY IF EXISTS "Sellers can delete their own samples" ON storage.objects;
CREATE POLICY "Sellers can delete their own samples"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'style-samples' AND
    auth.uid() IN (SELECT id FROM sellers)
  );

-- ─── user-uploads bucket policies ───────────────────────────────────────────
-- Users can view their own uploads
DROP POLICY IF EXISTS "Users can view their own uploads" ON storage.objects;
CREATE POLICY "Users can view their own uploads"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can upload their own files
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
CREATE POLICY "Users can upload their own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own uploads
DROP POLICY IF EXISTS "Users can update their own uploads" ON storage.objects;
CREATE POLICY "Users can update their own uploads"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own uploads
DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;
CREATE POLICY "Users can delete their own uploads"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── hd-outputs bucket policies ─────────────────────────────────────────────
-- Users can view their purchased HD outputs
DROP POLICY IF EXISTS "Users can view their purchased HD outputs" ON storage.objects;
CREATE POLICY "Users can view their purchased HD outputs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'hd-outputs' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- System can insert HD outputs (service role)
DROP POLICY IF EXISTS "System can insert HD outputs" ON storage.objects;
CREATE POLICY "System can insert HD outputs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'hd-outputs');

-- System can update HD outputs
DROP POLICY IF EXISTS "System can update HD outputs" ON storage.objects;
CREATE POLICY "System can update HD outputs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'hd-outputs');

-- ─── Success Message ────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '✅ Storage buckets created successfully!';
  RAISE NOTICE '📦 Buckets: style-samples (public), user-uploads (private), hd-outputs (private)';
  RAISE NOTICE '🔒 Storage policies configured';
END $$;
