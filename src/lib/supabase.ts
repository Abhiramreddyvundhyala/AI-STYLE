/**
 * Supabase Client Configuration
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Some features may not work.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Database types
export interface ModelSettings {
  id: string;
  model_id: string;
  is_enabled: boolean;
  updated_at: string;
  updated_by?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}
