-- ============================================================================
-- Style Blueprint System Migration
-- Converts uploaded style images into reusable "Style Blueprints"
-- ============================================================================

-- Step 1: Add blueprint columns to styles table
ALTER TABLE styles 
  ADD COLUMN IF NOT EXISTS style_blueprint JSONB,
  ADD COLUMN IF NOT EXISTS blueprint_processed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS blueprint_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS blueprint_error TEXT;

-- Step 2: Create indexes for efficient blueprint queries
CREATE INDEX IF NOT EXISTS idx_styles_blueprint ON styles USING GIN (style_blueprint);
CREATE INDEX IF NOT EXISTS idx_styles_blueprint_processed ON styles(blueprint_processed_at) 
  WHERE blueprint_processed_at IS NOT NULL;

-- Step 3: Create function to get style blueprint (public access, no sensitive data)
CREATE OR REPLACE FUNCTION get_style_blueprint(style_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  blueprint_result JSONB;
BEGIN
  SELECT style_blueprint INTO blueprint_result
  FROM styles
  WHERE id = style_id_param AND is_active = true;
  
  RETURN blueprint_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_style_blueprint(UUID) TO authenticated, anon;

-- Step 4: Add helpful comments
COMMENT ON COLUMN styles.style_blueprint IS 'Structured JSON containing extracted design DNA: colors, composition, lighting, style rules, etc.';
COMMENT ON COLUMN styles.blueprint_processed_at IS 'Timestamp when the blueprint was last generated from the sample image';
COMMENT ON COLUMN styles.blueprint_version IS 'Version of the blueprint processor used (for re-processing old styles)';
COMMENT ON COLUMN styles.blueprint_error IS 'Error message if blueprint processing failed';

-- ============================================================================
-- Example Blueprint Structure:
-- {
--   "design_category": "Portrait Photography",
--   "style_name": "Cinematic Moody Portrait",
--   "composition": {
--     "layout": "centered_portrait",
--     "focal_point": [0.5, 0.4],
--     "balance": "symmetrical"
--   },
--   "color_palette": {
--     "dominant": ["#1a1a2e", "#16213e", "#0f3460"],
--     "accent": ["#e94560", "#f39c12"],
--     "scheme": "dark_vibrant"
--   },
--   "lighting_style": {
--     "type": "dramatic_side_lighting",
--     "intensity": "high_contrast",
--     "direction": "45_degree_left"
--   },
--   "visual_hierarchy": ["subject_face", "lighting_drama", "background_blur"],
--   "camera_angle": "eye_level",
--   "subject_placement": "center_with_headroom",
--   "typography": {
--     "locations": [],
--     "style": "none",
--     "hierarchy": ""
--   },
--   "graphic_elements": ["bokeh_lights", "color_grading"],
--   "decorative_elements": ["soft_vignette"],
--   "effects": ["depth_of_field", "cinematic_grading"],
--   "editable_regions": {
--     "face": [{"x": 0.3, "y": 0.2, "width": 0.4, "height": 0.5}],
--     "text": [],
--     "objects": []
--   },
--   "fixed_elements": ["lighting_pattern", "color_grading", "composition_style"],
--   "customizable_elements": ["face_identity", "facial_expression", "clothing_style"],
--   "style_rules": [
--     "Maintain dramatic side lighting at 45 degrees",
--     "Preserve dark moody color palette",
--     "Keep background blurred with bokeh effect",
--     "Center subject with proper headroom"
--   ],
--   "recreation_instructions": "Create a cinematic portrait with dramatic side lighting...",
--   "metadata": {
--     "optimal_models": ["gpt-image-2", "midjourney-v8"],
--     "recommended_resolution": "1024x1024",
--     "face_preservation": true,
--     "processing_time": 1500
--   }
-- }
-- ============================================================================
