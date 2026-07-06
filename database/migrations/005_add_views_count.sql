-- ============================================================================
-- Add views_count column to styles table
-- ============================================================================

-- Add views_count column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'styles' AND column_name = 'views_count'
  ) THEN
    ALTER TABLE styles ADD COLUMN views_count INTEGER DEFAULT 0;
    CREATE INDEX IF NOT EXISTS idx_styles_views_count ON styles(views_count DESC);
  END IF;
END $$;

-- ============================================================================
-- End of Migration
-- ============================================================================
