-- Run this in Supabase SQL Editor to immediately fix duplicate packages

-- Step 1: Remove duplicates (keep oldest per name)
DELETE FROM public.packages
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM public.packages
  ORDER BY name, created_at ASC
);

-- Step 2: Add unique constraint so it never happens again
ALTER TABLE public.packages DROP CONSTRAINT IF EXISTS packages_name_key;
ALTER TABLE public.packages ADD CONSTRAINT packages_name_key UNIQUE (name);

-- Step 3: Verify (should show only 3 rows)
SELECT name, credits, price_inr FROM public.packages ORDER BY credits ASC;
