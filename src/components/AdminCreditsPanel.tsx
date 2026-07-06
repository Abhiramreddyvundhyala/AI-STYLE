/**
 * AdminCreditsPanel Component
 * Admin panel section for managing credit packages and system config.
 */

import { useState } from 'react';
import { Plus, Edit3, EyeOff, Save, X, Package, Settings } from 'lucide-react';
import {
  useAdminPackages,
  useCreatePackage,
  useUpdatePackage,
  useDeactivatePackage,
  useAdminConfig,
  useUpdateAdminConfig,
} from '@/hooks/useAdminCredits';
import type { CreditPackage } from '@/lib/credits.types';

// ─── Package Form ─────────────────────────────────────────────────────────────
interface PackageFormData {
  name: string;
  credits: string;
  price_inr: string;
  price_usd: string;
}

const EMPTY_FORM: PackageFormData = { name: '', credits: '', price_inr: '', price_usd: '' };

function PackageForm({
  initial,
  onSave,
  onCancel,
  isLoading,
}: {
  initial?: PackageFormData;
  onSave: (data: PackageFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<PackageFormData>(initial ?? EMPTY_FORM);

  const set = (key: keyof PackageFormData, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="p-4 rounded-xl border border-violet-200 bg-violet-50/50 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Package Name</label>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Starter Pack"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-violet-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Credits</label>
          <input
            type="number"
            value={form.credits}
            onChange={(e) => set('credits', e.target.value)}
            placeholder="10"
            min="1"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-violet-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Price (INR ₹)</label>
          <input
            type="number"
            value={form.price_inr}
            onChange={(e) => set('price_inr', e.target.value)}
            placeholder="149"
            step="0.01"
            min="0"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-violet-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Price (USD $) — Reference</label>
          <input
            type="number"
            value={form.price_usd}
            onChange={(e) => set('price_usd', e.target.value)}
            placeholder="1.79"
            step="0.01"
            min="0"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-violet-400"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <X size={14} className="inline mr-1" /> Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={isLoading || !form.name || !form.credits || !form.price_inr}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? (
            <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AdminCreditsPanel() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: packages = [], isLoading: pkgLoading } = useAdminPackages();
  const { data: config, isLoading: cfgLoading } = useAdminConfig();
  const createPkg = useCreatePackage();
  const updatePkg = useUpdatePackage();
  const deactivatePkg = useDeactivatePackage();
  const updateConfig = useUpdateAdminConfig();

  const [configForm, setConfigForm] = useState({
    free_generations_per_month: '',
    credits_per_generation: '',
  });

  // Sync config form when loaded
  const initConfigForm = () => {
    if (config && !configForm.free_generations_per_month) {
      setConfigForm({
        free_generations_per_month: config.free_generations_per_month,
        credits_per_generation: config.credits_per_generation,
      });
    }
  };

  if (!cfgLoading && config && !configForm.free_generations_per_month) {
    initConfigForm();
  }

  const handleCreatePackage = async (data: PackageFormData) => {
    await createPkg.mutateAsync({
      name: data.name,
      credits: parseInt(data.credits),
      price_inr: parseFloat(data.price_inr),
      price_usd: parseFloat(data.price_usd),
    });
    setShowAddForm(false);
  };

  const handleUpdatePackage = async (id: string, data: PackageFormData) => {
    await updatePkg.mutateAsync({
      id,
      name: data.name,
      credits: parseInt(data.credits),
      price_inr: parseFloat(data.price_inr),
      price_usd: parseFloat(data.price_usd),
    });
    setEditingId(null);
  };

  const handleDeactivate = async (pkg: CreditPackage) => {
    if (!confirm(`Deactivate "${pkg.name}"? Users won't be able to buy this package.`)) return;
    await deactivatePkg.mutateAsync(pkg.id);
  };

  const handleSaveConfig = async () => {
    await updateConfig.mutateAsync({
      free_generations_per_month: configForm.free_generations_per_month,
      credits_per_generation: configForm.credits_per_generation,
    });
  };

  return (
    <div className="space-y-8">
      {/* ── Packages Section ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-violet-600" />
            <h3 className="text-lg font-bold text-gray-900">Credit Packages</h3>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
          >
            <Plus size={14} /> Add Package
          </button>
        </div>

        {showAddForm && (
          <div className="mb-4">
            <PackageForm
              onSave={handleCreatePackage}
              onCancel={() => setShowAddForm(false)}
              isLoading={createPkg.isPending}
            />
          </div>
        )}

        {pkgLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {packages.map((pkg) => (
              <div key={pkg.id}>
                {editingId === pkg.id ? (
                  <PackageForm
                    initial={{
                      name: pkg.name,
                      credits: String(pkg.credits),
                      price_inr: String(pkg.price_inr),
                      price_usd: String(pkg.price_usd),
                    }}
                    onSave={(data) => handleUpdatePackage(pkg.id, data)}
                    onCancel={() => setEditingId(null)}
                    isLoading={updatePkg.isPending}
                  />
                ) : (
                  <div className={`flex items-center justify-between p-4 rounded-xl border ${pkg.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{pkg.name}</div>
                        <div className="text-xs text-gray-500">{pkg.credits} credits</div>
                      </div>
                      <div className="text-sm">
                        <span className="font-bold text-gray-800">₹{pkg.price_inr}</span>
                        <span className="text-gray-400 ml-2 text-xs">${pkg.price_usd}</span>
                      </div>
                      {!pkg.is_active && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-500 rounded-full">Inactive</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingId(pkg.id)}
                        className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit3 size={14} />
                      </button>
                      {pkg.is_active && (
                        <button
                          onClick={() => handleDeactivate(pkg)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Deactivate"
                        >
                          <EyeOff size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── System Config Section ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Settings size={18} className="text-gray-600" />
          <h3 className="text-lg font-bold text-gray-900">System Config</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Changes apply immediately to all users. All values come from the database — nothing is hardcoded.
        </p>

        {cfgLoading ? (
          <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
        ) : (
          <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Free Generations per Month
                </label>
                <input
                  type="number"
                  value={configForm.free_generations_per_month}
                  onChange={(e) => setConfigForm((f) => ({ ...f, free_generations_per_month: e.target.value }))}
                  min="1"
                  max="100"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                />
                <p className="text-xs text-gray-400 mt-1">Currently: {config?.free_generations_per_month ?? '...'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Credits per Generation
                </label>
                <input
                  type="number"
                  value={configForm.credits_per_generation}
                  onChange={(e) => setConfigForm((f) => ({ ...f, credits_per_generation: e.target.value }))}
                  min="1"
                  max="10"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                />
                <p className="text-xs text-gray-400 mt-1">Currently: {config?.credits_per_generation ?? '...'}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSaveConfig}
                disabled={updateConfig.isPending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {updateConfig.isPending ? (
                  <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Save Config
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
