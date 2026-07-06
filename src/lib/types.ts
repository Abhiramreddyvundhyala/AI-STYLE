// ─── AI Model Types ─────────────────────────────────────────────────────────
export type ModelType =
  | 'gptimage'      // GPT Image 2
  | 'gptimage1'     // GPT Image 1
  | 'nanobanana2'   // Nano Banana 2
  | 'nanobanana'    // Nano Banana
  | 'midjourney'    // Midjourney
  | 'seedance'      // Seedance 2.0 (video)
  | 'veo'           // Veo 3.1
  | 'flux'          // Flux models
  | 'dalle'         // DALL·E 3
  | 'other';

export type MediaType = 'image' | 'video';

export type ContentCategory =
  | 'Illustration & 3D'
  | 'Photography'
  | 'Product & Brand'
  | 'Food & Drink'
  | 'Fashion'
  | 'Architecture'
  | 'Character'
  | 'Cinematic'
  | 'Abstract'
  | 'Other';

// ─── Model Metadata ─────────────────────────────────────────────────────────
export interface ModelInfo {
  id: ModelType;
  name: string;
  shortName: string;
  icon: string;       // Lucide icon name or SVG path
  color: string;       // Brand color
  description: string;
}

export const MODEL_REGISTRY: Record<ModelType, ModelInfo> = {
  gptimage: {
    id: 'gptimage',
    name: 'GPT Image 2',
    shortName: 'GPT Image',
    icon: 'sparkles',
    color: '#10a37f',
    description: 'OpenAI GPT Image 2 — photorealistic & creative',
  },
  gptimage1: {
    id: 'gptimage1',
    name: 'GPT Image 1',
    shortName: 'GPT Image 1',
    icon: 'sparkles',
    color: '#10a37f',
    description: 'OpenAI GPT Image 1',
  },
  nanobanana2: {
    id: 'nanobanana2',
    name: 'Nano Banana 2',
    shortName: 'Nano Banana 2',
    icon: 'banana',
    color: '#fbbf24',
    description: 'Nano Banana 2 — stylized & artistic',
  },
  nanobanana: {
    id: 'nanobanana',
    name: 'Nano Banana',
    shortName: 'Nano Banana',
    icon: 'banana',
    color: '#f59e0b',
    description: 'Original Nano Banana model',
  },
  midjourney: {
    id: 'midjourney',
    name: 'Midjourney',
    shortName: 'Midjourney',
    icon: 'diamond',
    color: '#5865f2',
    description: 'Midjourney — painterly & cinematic',
  },
  seedance: {
    id: 'seedance',
    name: 'Seedance 2.0',
    shortName: 'Seedance',
    icon: 'video',
    color: '#ec4899',
    description: 'Seedance 2.0 — AI video generation',
  },
  veo: {
    id: 'veo',
    name: 'Veo 3.1',
    shortName: 'Veo',
    icon: 'play-circle',
    color: '#4285f4',
    description: 'Google Veo 3.1 — video generation',
  },
  flux: {
    id: 'flux',
    name: 'Flux',
    shortName: 'Flux',
    icon: 'zap',
    color: '#8b5cf6',
    description: 'Flux — fast image generation',
  },
  dalle: {
    id: 'dalle',
    name: 'DALL·E 3',
    shortName: 'DALL·E',
    icon: 'image',
    color: '#10a37f',
    description: 'OpenAI DALL·E 3',
  },
  other: {
    id: 'other',
    name: 'Other',
    shortName: 'Other',
    icon: 'image',
    color: '#6b7280',
    description: 'Other AI models',
  },
};

// ─── Prompt (Core Entity) ───────────────────────────────────────────────────
export interface Prompt {
  id: string;                        // UUID or tweet ID
  text: string;                      // The actual prompt text
  media_urls: string[];              // Array of generated image/video URLs
  media_type: MediaType;             // 'image' or 'video'
  model: ModelType;                  // Which AI model was used
  content_categories: ContentCategory[]; // Tags for filtering

  // Author info
  author_username: string;
  author_display_name: string;
  author_avatar_url: string;
  source_url?: string;               // Link to original tweet/post

  // Engagement metrics
  likes: number;
  views: number;
  copies: number;                    // How many times prompt was copied

  // Timestamps
  created_at: string;
  scraped_at?: string;

  // Search & filtering
  tags: string[];
  language: string;
  is_featured: boolean;
  is_active: boolean;

  // Optional: Parsed prompt segments (for multi-prompt tweets)
  prompt_segments?: PromptSegment[];
}

export interface PromptSegment {
  text: string;
  image_index?: number;              // Which image this segment maps to
}

// ─── User Profile ───────────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  saved_prompts: string[];           // Bookmarked prompt IDs
  daily_credits: number;             // For one-click generation
  total_generations: number;
  created_at: string;
}

// ─── Generation ─────────────────────────────────────────────────────────────
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Generation {
  id: string;
  user_id: string;
  prompt_id: string;
  prompt_text: string;
  model_used: ModelType;
  output_url: string;
  status: GenerationStatus;
  created_at: string;
}

// ─── Filter State ───────────────────────────────────────────────────────────
export interface GalleryFilters {
  model?: ModelType | 'all';
  category?: ContentCategory | 'all' | 'videos';
  query?: string;
  sort?: 'trending' | 'newest' | 'most_liked' | 'most_viewed';
  page?: number;
}

// ─── API Response Types ─────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
