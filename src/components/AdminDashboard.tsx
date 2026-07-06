/**
 * Admin Dashboard Component
 * 
 * Manage AI models, view analytics, and configure system settings
 */

import { useState } from 'react';
import { useModelSettings } from '@/hooks/useModelSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { 
  Settings, 
  Sparkles, 
  BarChart3, 
  Users, 
  Image as ImageIcon,
  RefreshCw,
  Shield,
  CheckCircle2,
  XCircle,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { AIModel } from '@/types/models';

import { ModelSettingsPanel } from './ModelSettingsPanel';
import { AdminCreditsPanel } from './AdminCreditsPanel';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('models');

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="w-8 h-8 text-[#FF6B35]" />
              Admin Dashboard
            </h1>
            <p className="text-white/60 mt-2">
              Manage AI models and system configuration
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#1A1A24] border border-white/10">
          <TabsTrigger value="models" className="data-[state=active]:bg-[#FF6B35]">
            <Settings className="w-4 h-4 mr-2" />
            Model Management
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-[#FF6B35]">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-[#FF6B35]">
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="credits" className="data-[state=active]:bg-[#FF6B35]">
            <Zap className="w-4 h-4 mr-2" />
            Credits & Packages
          </TabsTrigger>
        </TabsList>

        {/* Model Management Tab */}
        <TabsContent value="models" className="space-y-6 mt-6">
          <ModelSettingsPanel />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-6">
          <Card className="bg-[#1A1A24] border-white/10">
            <CardHeader>
              <CardTitle>Usage Analytics</CardTitle>
              <CardDescription>
                Track model usage and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-white/60">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Analytics dashboard coming soon...</p>
                <p className="text-sm mt-2">Track generations, costs, and performance</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-6">
          <Card className="bg-[#1A1A24] border-white/10">
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user accounts and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-white/60">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>User management coming soon...</p>
                <p className="text-sm mt-2">Control access and permissions</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credits & Packages Tab */}
        <TabsContent value="credits" className="mt-6">
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Credits & Packages</CardTitle>
              <CardDescription className="text-gray-500">
                Manage credit packages and system configuration. All values are database-driven.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminCreditsPanel />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
