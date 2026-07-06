/**
 * Model Selector Component
 * Allows users to select which AI model to use for generation
 * All models support face matching and encrypted prompts
 */

import { useState } from 'react';
import { AI_MODELS, type AIModel } from '@/types/models';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Check } from 'lucide-react';

interface ModelSelectorProps {
  selectedModelId: string;
  onModelSelect: (modelId: string) => void;
  showOnlyEnabled?: boolean;
}

export function ModelSelector({
  selectedModelId,
  onModelSelect,
  showOnlyEnabled = true,
}: ModelSelectorProps) {
  const models = showOnlyEnabled
    ? AI_MODELS.filter((m) => m.isEnabled)
    : AI_MODELS;

  const featuredModels = models.filter((m) => m.category === 'featured');
  const basicModels = models.filter((m) => m.category === 'basic');

  return (
    <div className="space-y-6">
      {/* Featured Models */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Featured Models</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredModels.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              isSelected={selectedModelId === model.id}
              onSelect={() => onModelSelect(model.id)}
            />
          ))}
        </div>
      </div>

      {/* Basic Models */}
      {basicModels.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Basic Models</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {basicModels.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                isSelected={selectedModelId === model.id}
                onSelect={() => onModelSelect(model.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ModelCardProps {
  model: AIModel;
  isSelected: boolean;
  onSelect: () => void;
}

function ModelCard({ model, isSelected, onSelect }: ModelCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-lg ${
        isSelected
          ? 'ring-2 ring-orange-500 bg-orange-500/10'
          : 'hover:bg-gray-800/50'
      }`}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{model.icon}</span>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {model.name}
                {model.isNew && (
                  <Badge variant="secondary" className="text-xs">
                    New
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {getProviderName(model.provider)}
              </CardDescription>
            </div>
          </div>
          {isSelected && (
            <div className="bg-orange-500 rounded-full p-1">
              <Check className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-400">{model.description}</p>
        <div className="mt-3 flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            🔒 Encrypted
          </Badge>
          <Badge variant="outline" className="text-xs">
            😊 Face Match
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function getProviderName(provider: AIModel['provider']): string {
  const names = {
    google: 'Google',
    openai: 'OpenAI',
    bytedance: 'ByteDance',
    midjourney: 'Midjourney',
    blackforest: 'Black Forest Labs',
    zimage: 'Z Image',
  };
  return names[provider] || provider;
}
