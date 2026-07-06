-- ============================================================================
-- Wishlist, Follows, and Uploads Tables Migration
-- Run this in Supabase SQL Editor to add missing tables
-- Safe to run multiple times - checks if things exist first
-- ============================================================================

-- ─── User Wishlists Table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  style_id UUID NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, style_id)
);

-- Enable RLS
ALTER TABLE user_wishlists ENABLE ROW LEVEL SECURITY;

-- Policies (drop if exists, then create)
DROP POLICY IF EXISTS "Users can view their own wishlists" ON user_wishlists;
CREATE POLICY "Users can view their own wishlists"
  ON user_wishlists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add to their wishlist" ON user_wishlists;
CREATE POLICY "Users can add to their wishlist"
  ON user_wishlists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove from their wishlist" ON user_wishlists;
CREATE POLICY "Users can remove from their wishlist"
  ON user_wishlists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_wishlists_user_id ON user_wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wishlists_style_id ON user_wishlists(style_id);

-- ─── User Follows Table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, seller_id)
);

-- Enable RLS
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- Policies (drop if exists, then create)
DROP POLICY IF EXISTS "Users can view their own follows" ON user_follows;
CREATE POLICY "Users can view their own follows"
  ON user_follows FOR SELECT
  TO authenticated
  USING (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can follow sellers" ON user_follows;
CREATE POLICY "Users can follow sellers"
  ON user_follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can unfollow sellers" ON user_follows;
CREATE POLICY "Users can unfollow sellers"
  ON user_follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- Sellers can see who follows them
DROP POLICY IF EXISTS "Sellers can view their followers" ON user_follows;
CREATE POLICY "Sellers can view their followers"
  ON user_follows FOR SELECT
  TO authenticated
  USING (auth.uid() = seller_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_seller_id ON user_follows(seller_id);

-- ─── User Uploads Table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_uploads ENABLE ROW LEVEL SECURITY;

-- Policies (drop if exists, then create)
DROP POLICY IF EXISTS "Users can view their own uploads" ON user_uploads;
CREATE POLICY "Users can view their own uploads"
  ON user_uploads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upload files" ON user_uploads;
CREATE POLICY "Users can upload files"
  ON user_uploads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their uploads" ON user_uploads;
CREATE POLICY "Users can delete their uploads"
  ON user_uploads FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_uploads_user_id ON user_uploads(user_id);

-- ─── Add views_count to styles table ────────────────────────────────────────
ALTER TABLE styles ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_styles_views_count ON styles(views_count);

-- ─── Success Message ────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '📊 Created tables: user_wishlists, user_follows, user_uploads';
  RAISE NOTICE '🔒 RLS policies enabled on all tables';
  RAISE NOTICE '⚡ Indexes created for performance';
END $$;
