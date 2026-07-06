/**
 * Style Blueprint Type Definitions
 * 
 * These types define the structure of Style Blueprints - the extracted design DNA
 * from style reference images that can be reused for future generations.
 */

/**
 * Normalized coordinates for regions (0.0 to 1.0)
 */
export interface NormalizedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  description?: string;
}

/**
 * Composition information
 */
export interface BlueprintComposition {
  layout: string; // e.g., "centered_portrait", "rule_of_thirds", "golden_ratio"
  focal_point: [number, number]; // Normalized coordinates
  balance: string; // "symmetrical" | "asymmetrical"
}

/**
 * Color palette information
 */
export interface BlueprintColorPalette {
  dominant: string[]; // Hex color codes
  accent: string[]; // Hex color codes
  scheme: string; // e.g., "dark_vibrant", "light_pastel", "monochrome"
}

/**
 * Lighting style information
 */
export interface BlueprintLightingStyle {
  type: string; // e.g., "natural", "dramatic", "soft", "studio"
  intensity: string; // e.g., "high_contrast", "low_key", "bright"
  direction: string; // e.g., "front", "side", "back", "45_degree_left"
}

/**
 * Typography information
 */
export interface BlueprintTypography {
  locations: string[]; // Text placement areas
  style: string; // Font style category or "none"
  hierarchy: string; // Text hierarchy description
}

/**
 * Editable regions where content can be swapped
 */
export interface BlueprintEditableRegions {
  face: NormalizedRegion[];
  text: NormalizedRegion[];
  objects: NormalizedRegion[];
}

/**
 * Metadata about the blueprint
 */
export interface BlueprintMetadata {
  optimal_models?: string[]; // Recommended AI models
  recommended_resolution?: string; // e.g., "1024x1024"
  aspect_ratio?: string; // e.g., "1:1", "16:9"
  face_preservation?: boolean;
  supports_face_swapping?: boolean;
  requires_reference_image?: boolean;
  complexity?: 'simple' | 'medium' | 'complex';
  processing_time_estimate?: number; // milliseconds
  processing_time?: number; // actual processing time
  processed_at?: string; // ISO timestamp
  version?: number;
  created_at?: string; // ISO timestamp
  tags?: string[];
}

/**
 * Complete Style Blueprint structure
 */
export interface StyleBlueprint {
  // Core identification
  design_category: string; // e.g., "Portrait Photography", "Product Photography"
  style_name: string; // Descriptive name for the style
  
  // Composition and layout
  composition?: BlueprintComposition | string;
  layout_structure: string; // Overall structure description
  visual_hierarchy: string[]; // Elements in order of importance
  camera_angle: string; // e.g., "eye_level", "high_angle", "low_angle"
  
  // Visual styling
  color_palette?: BlueprintColorPalette | string[];
  lighting_style: BlueprintLightingStyle | string;
  background_description: string;
  subject_placement: string;
  
  // Typography (if present)
  typography: BlueprintTypography;
  
  // Design elements
  graphic_elements: string[];
  decorative_elements: string[];
  effects: string[];
  
  // Editable and fixed regions
  editable_regions: BlueprintEditableRegions;
  fixed_elements: string[];
  customizable_elements: string[];
  
  // Generation rules
  style_rules: string[];
  recreation_instructions: string; // Master prompt for recreating the style
  
  // Metadata
  metadata?: BlueprintMetadata;
}

/**
 * Style record from database with blueprint
 */
export interface StyleWithBlueprint {
  id: string;
  title: string;
  category: string;
  price: number;
  description?: string;
  sample_image_url: string;
  seller_id: string;
  sales_count: number;
  avg_rating: number;
  is_active: boolean;
  tags?: string[];
  created_at: string;
  
  // Blueprint fields
  style_blueprint?: StyleBlueprint | null;
  blueprint_processed_at?: string | null;
  blueprint_version?: number | null;
  blueprint_error?: string | null;
}

/**
 * Request to process a style blueprint
 */
export interface ProcessBlueprintRequest {
  styleId: string;
  imageUrl: string;
  forceReprocess?: boolean;
}

/**
 * Response from blueprint processing
 */
export interface ProcessBlueprintResponse {
  success: boolean;
  blueprint?: StyleBlueprint;
  processingTime?: number;
  cached?: boolean;
  error?: string;
}

/**
 * Generation request
 */
export interface GenerationRequest {
  modelId: string;
  
  // Style-based generation
  styleId?: string;
  
  // Fallback
  encryptedPrompt?: string;
  prompt?: string;
  
  // User customization
  userImageUrl?: string;
  textModifications?: string;
  
  // Face matching
  faceEmbedding?: number[];
  faceBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  preserveFaceStrength?: number;
  
  // Image settings
  width?: number;
  height?: number;
  numOutputs?: number;
}

/**
 * Generation response
 */
export interface GenerationResponse {
  imageUrl: string;
  faceMatchScore?: number;
  modelUsed: string;
  processingTime: number;
  usedBlueprint?: boolean;
  error?: string;
}

/**
 * Helper function to check if a style has a valid blueprint
 */
export function hasValidBlueprint(style: StyleWithBlueprint): boolean {
  return !!(
    style.style_blueprint &&
    style.blueprint_processed_at &&
    !style.blueprint_error
  );
}

/**
 * Helper function to get optimal models from blueprint
 */
export function getOptimalModels(blueprint: StyleBlueprint): string[] {
  return blueprint.metadata?.optimal_models || [];
}

/**
 * Helper function to check if blueprint supports face swapping
 */
export function supportsFaceSwapping(blueprint: StyleBlueprint): boolean {
  return (
    blueprint.metadata?.supports_face_swapping !== false &&
    blueprint.editable_regions?.face?.length > 0
  );
}

/**
 * Helper function to get recommended resolution
 */
export function getRecommendedResolution(blueprint: StyleBlueprint): { width: number; height: number } {
  const resolution = blueprint.metadata?.recommended_resolution || '1024x1024';
  const [width, height] = resolution.split('x').map(Number);
  return { width, height };
}

/**
 * Helper function to extract dominant color
 */
export function getDominantColor(blueprint: StyleBlueprint): string | null {
  if (!blueprint.color_palette) return null;
  
  if (Array.isArray(blueprint.color_palette)) {
    return blueprint.color_palette[0] || null;
  }
  
  if (typeof blueprint.color_palette === 'object' && 'dominant' in blueprint.color_palette) {
    return blueprint.color_palette.dominant[0] || null;
  }
  
  return null;
}

/**
 * Blueprint processing status
 */
export enum BlueprintStatus {
  NOT_PROCESSED = 'not_processed',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Get blueprint processing status
 */
export function getBlueprintStatus(style: StyleWithBlueprint): BlueprintStatus {
  if (style.blueprint_error) {
    return BlueprintStatus.FAILED;
  }
  
  if (style.style_blueprint && style.blueprint_processed_at) {
    return BlueprintStatus.COMPLETED;
  }
  
  // If it's a new style (created recently) without blueprint, it might be processing
  const createdAt = new Date(style.created_at);
  const now = new Date();
  const ageMinutes = (now.getTime() - createdAt.getTime()) / 1000 / 60;
  
  if (ageMinutes < 5) {
    return BlueprintStatus.PROCESSING;
  }
  
  return BlueprintStatus.NOT_PROCESSED;
}
