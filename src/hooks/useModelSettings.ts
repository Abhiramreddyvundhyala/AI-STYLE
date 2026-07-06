/**
 * Hook for managing AI model settings
 */

import { useState, useEffect, useCallback } from 'react';
import { AI_MODELS, type AIModel } from '@/types/models';
import { supabase } from '@/lib/supabase';

export function useModelSettings() {
  const [models, setModels] = useState<AIModel[]>(AI_MODELS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load model settings from Supabase
  const loadModelSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('model_settings')
        .select('*');

      if (error) throw error;

      if (data && data.length > 0) {
        // Update models with database settings
        const updatedModels = AI_MODELS.map(model => {
          const dbSetting = data.find(d => d.model_id === model.id);
          return dbSetting 
            ? { ...model, isEnabled: dbSetting.is_enabled }
            : model;
        });
        setModels(updatedModels);
      } else {
        // Use default settings
        setModels(AI_MODELS);
      }
    } catch (err) {
      console.error('Error loading model settings:', err);
      setError(err instanceof Error ? err : new Error('Failed to load settings'));
      // Fallback to default models
      setModels(AI_MODELS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Toggle model enabled/disabled
  const toggleModel = useCallback(async (modelId: string) => {
    try {
      const model = models.find(m => m.id === modelId);
      if (!model) return;

      const newEnabledState = !model.isEnabled;

      // Update in database
      const { error } = await supabase
        .from('model_settings')
        .upsert({
          model_id: modelId,
          is_enabled: newEnabledState,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'model_id'
        });

      if (error) throw error;

      // Update local state
      setModels(prev => 
        prev.map(m => 
          m.id === modelId 
            ? { ...m, isEnabled: newEnabledState }
            : m
        )
      );
    } catch (err) {
      console.error('Error toggling model:', err);
      throw err;
    }
  }, [models]);

  // Get enabled models only
  const getEnabledModels = useCallback(() => {
    return models.filter(m => m.isEnabled);
  }, [models]);

  // Get models by category
  const getModelsByCategory = useCallback((category: 'featured' | 'basic') => {
    return models.filter(m => m.category === category);
  }, [models]);

  useEffect(() => {
    loadModelSettings();
  }, [loadModelSettings]);

  return {
    models,
    isLoading,
    error,
    toggleModel,
    getEnabledModels,
    getModelsByCategory,
    reload: loadModelSettings,
  };
}
