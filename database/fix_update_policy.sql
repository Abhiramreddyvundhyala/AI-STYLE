-- ============================================================================
-- Fix RLS Policy for Updating Styles
-- This fixes the "new row violates row-level security policy" error
-- ============================================================================

-- Drop the existing restrictive update policy
DROP POLICY IF EXISTS "Sellers can update their own styles" ON styles;

-- Create a new update policy that allows sellers to update their styles
-- The key is using WITH CHECK clause properly
CREATE POLICY "Sellers can update their own styles"
  ON styles FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- Also ensure the SELECT policy allows sellers to see their own styles
DROP POLICY IF EXISTS "Sellers can view their own styles" ON styles;

CREATE POLICY "Sellers can view their own styles"
  ON styles FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid() OR is_active = true);

-- Verify policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'styles'
ORDER BY policyname;

-- ============================================================================
-- How to run this script:
-- 1. Go to your Supabase Dashboard
-- 2. Click on "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Copy and paste this entire script
-- 5. Click "Run" button
-- 6. You should see the policies listed at the end
-- ============================================================================
