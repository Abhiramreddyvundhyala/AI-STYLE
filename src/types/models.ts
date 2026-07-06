/**
 * AI Model Types and Definitions
 *
 * INTERNAL ONLY — the single model used for generation is never exposed to the UI.
 */

export interface AIModel {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'featured' | 'basic';
  provider: 'google' | 'openai' | 'bytedance' | 'midjourney' | 'blackforest' | 'zimage';
  isNew?: boolean;
  isEnabled: boolean;
  apiEndpoint?: string;
  modelIdentifier: string;
}

// Single internal model — never displayed to users
export const DEFAULT_MODEL_ID = 'seedream-5-lite';

export const AI_MODELS: AIModel[] = [
  {
    id: DEFAULT_MODEL_ID,
    name: 'StyleGen',
    description: 'Internal generation engine',
    icon: '✨',
    category: 'featured',
    provider: 'bytedance',
    isEnabled: true,
    modelIdentifier: 'seedream-5-lite',
  },
];
