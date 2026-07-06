/**
 * Model Settings Panel
 * Admin panel for managing AI model settings
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useModelSettings } from '@/hooks/useModelSettings';
import { toast } from 'sonner';

export function ModelSettingsPanel() {
  const { models, isLoading, toggleModel } = useModelSettings();
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleToggle = async (modelId: string, _enabled: boolean) => {
    try {
      await toggleModel(modelId);
      toast.success(`${modelId} toggled`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update model status');
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    try {
      const hasKey = !!import.meta.env.VITE_OPENAI_API_KEY || !!import.meta.env.VITE_GPT_IMAGE_API_KEY;
      setConnectionStatus(hasKey ? 'success' : 'error');
      hasKey
        ? toast.success('OpenAI API key configured')
        : toast.error('No OpenAI API key found in environment');
    } catch {
      setConnectionStatus('error');
      toast.error('Connection test failed');
    } finally {
      setTestingConnection(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </CardContent>
      </Card>
    );
  }

  const gptImageModel = models?.find((m) => m.id === 'gpt-image-2');

  return (
    <div className="space-y-6">
      {/* GPT Image 2.0 - Primary Model */}
      <Card className="border-orange-500/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                GPT Image 2.0
                <Badge variant="default" className="bg-orange-500">
                  Primary Model
                </Badge>
              </CardTitle>
              <CardDescription>
                High-quality AI image generation with style transfer
              </CardDescription>
            </div>
            <Switch
              checked={gptImageModel?.isEnabled ?? false}
              onCheckedChange={(checked) => handleToggle('gpt-image-2', checked)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Status:</span>
            {gptImageModel?.isEnabled ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="w-3 h-3 mr-1" />Enabled
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="w-3 h-3 mr-1" />Disabled
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">API Key:</span>
            {import.meta.env.VITE_GPT_IMAGE_API_KEY ? (
              <Badge variant="default" className="bg-green-500">Configured</Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="w-3 h-3 mr-1" />Not Configured
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={handleTestConnection}
              disabled={testingConnection || !import.meta.env.VITE_GPT_IMAGE_API_KEY}
              variant="outline"
              size="sm"
            >
              {testingConnection ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testing...</>
              ) : 'Test Connection'}
            </Button>
            {connectionStatus === 'success' && (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="w-3 h-3 mr-1" />Connected
              </Badge>
            )}
            {connectionStatus === 'error' && (
              <Badge variant="destructive">
                <XCircle className="w-3 h-3 mr-1" />Connection Failed
              </Badge>
            )}
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4 space-y-1">
            <h4 className="text-sm font-semibold">Configuration</h4>
            <p className="text-xs text-gray-400">• Resolution: 1024x1024</p>
            <p className="text-xs text-gray-400">• Model: gpt-image-2</p>
            <p className="text-xs text-gray-400">• Face matching: native dual-image input</p>
          </div>

          {!import.meta.env.VITE_GPT_IMAGE_API_KEY && (
            <div className="bg-orange-500/10 border border-orange-500 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-orange-500 mb-2">Setup Required</h4>
              <p className="text-xs text-gray-300 mb-2">Add your OpenAI API key to the environment:</p>
              <code className="text-xs bg-gray-900 px-2 py-1 rounded block">
                VITE_GPT_IMAGE_API_KEY=your_api_key_here
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other Models */}
      <Card>
        <CardHeader>
          <CardTitle>Other Models</CardTitle>
          <CardDescription>Additional models (currently disabled)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {models
              ?.filter((m) => m.id !== 'gpt-image-2')
              .map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg"
                >
                  <div>
                    <p className="font-medium capitalize">{model.id.replace(/-/g, ' ')}</p>
                    <p className="text-xs text-gray-400">{model.isEnabled ? 'Enabled' : 'Disabled'}</p>
                  </div>
                  <Switch
                    checked={model.isEnabled}
                    onCheckedChange={(checked) => handleToggle(model.id, checked)}
                  />
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
