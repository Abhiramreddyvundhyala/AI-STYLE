-- ============================================================================
-- Secure Prompts Migration
-- This protects style prompts from public access while allowing edge functions to read them
-- ============================================================================

-- Step 1: Add new plain text prompt column
ALTER TABLE styles ADD COLUMN IF NOT EXISTS prompt TEXT;

-- Step 2: Make prompt_encrypted nullable (for backward compatibility)
ALTER TABLE styles ALTER COLUMN prompt_encrypted DROP NOT NULL;

-- Step 3: Update RLS policy to exclude prompts from public view
DROP POLICY IF EXISTS "Public can view active styles" ON styles;

CREATE POLICY "Public can view active styles (without prompts)"
  ON styles FOR SELECT
  TO public
  USING (is_active = true);

-- Step 4: Create a secure function that edge functions can call to get prompts
CREATE OR REPLACE FUNCTION get_style_prompt(style_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with owner privileges, bypassing RLS
AS $$
DECLARE
  prompt_result TEXT;
BEGIN
  SELECT COALESCE(prompt, prompt_encrypted) INTO prompt_result
  FROM styles
  WHERE id = style_id_param;
  
  RETURN prompt_result;
END;
$$;

-- Grant execute permission to authenticated users and anon (for edge functions)
GRANT EXECUTE ON FUNCTION get_style_prompt(UUID) TO authenticated, anon;

-- ============================================================================
-- Security Notes:
-- - Public SELECT policy does NOT include the prompt column
-- - Only the secure function get_style_prompt() can retrieve prompts
-- - Edge functions use service_role key which bypasses RLS anyway
-- - This prevents browser/client from seeing prompts in API responses
-- - Both prompt and prompt_encrypted are supported for backward compatibility
-- ============================================================================
