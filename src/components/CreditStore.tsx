/**
 * CreditStore Component
 * Full credit store with package cards, currency toggle, and Razorpay checkout.
 */

import { useState } from 'react';
import { Zap, Star, Rocket, Check, Sparkles } from 'lucide-react';
import { usePackages, useBuyCredits, useCreditsBalance } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';
import type { CreditPackage } from '@/lib/credits.types';

// USD exchange rate multiplier removed — INR only

interface PackageCardProps {
  pkg: CreditPackage;
  isPopular?: boolean;
  onBuy: () => void;
  isLoading: boolean;
}

const PACKAGE_ICONS = [Zap, Star, Rocket];
const PACKAGE_COLORS = [
  { bg: 'from-blue-50 to-violet-50', border: 'border-blue-200', accent: 'text-blue-600', btn: 'from-blue-500 to-violet-500', shadow: 'shadow-blue-500/20' },
  { bg: 'from-violet-50 to-fuchsia-50', border: 'border-violet-300', accent: 'text-violet-700', btn: 'from-violet-600 to-fuchsia-600', shadow: 'shadow-violet-500/30' },
  { bg: 'from-amber-50 to-orange-50', border: 'border-amber-200', accent: 'text-amber-700', btn: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/20' },
];

function PackageCard({ pkg, isPopular, onBuy, isLoading }: PackageCardProps) {
  const colorIdx = isPopular ? 1 : pkg.credits >= 75 ? 2 : 0;
  const colors = PACKAGE_COLORS[colorIdx] || PACKAGE_COLORS[0];
  const Icon = PACKAGE_ICONS[colorIdx] || PACKAGE_ICONS[0];

  const displayPrice = `₹${pkg.price_inr.toLocaleString('en-IN')}`;

  return (
    <div className={`
      relative flex flex-col p-6 rounded-2xl border bg-gradient-to-br ${colors.bg} ${colors.border}
      transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${colors.shadow}
      ${isPopular ? 'ring-2 ring-violet-500 ring-offset-2' : ''}
    `}>
      {/* Popular badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-xs font-bold rounded-full shadow-lg whitespace-nowrap">
          ⭐ Most Popular
        </div>
      )}

      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl bg-white border ${colors.border} flex items-center justify-center mb-4 shadow-sm`}>
        <Icon size={22} className={colors.accent} />
      </div>

      {/* Package name */}
      <h3 className="text-lg font-bold text-gray-900 mb-1">{pkg.name}</h3>

      {/* Credits */}
      <div className="flex items-baseline gap-1 mb-1">
        <span className={`text-3xl font-black ${colors.accent}`}>{pkg.credits}</span>
        <span className="text-sm font-medium text-gray-500">Credits</span>
      </div>

      {/* Credit = generation note */}
      <p className="text-xs text-gray-400 mb-4">1 credit = 1 image generation</p>

      {/* Features */}
      <ul className="space-y-2 mb-6 flex-1">
        <li className="flex items-center gap-2 text-sm text-gray-600">
          <Check size={14} className="text-green-500 flex-shrink-0" />
          <span>Never expires</span>
        </li>
        <li className="flex items-center gap-2 text-sm text-gray-600">
          <Check size={14} className="text-green-500 flex-shrink-0" />
          <span>All AI models included</span>
        </li>
        <li className="flex items-center gap-2 text-sm text-gray-600">
          <Check size={14} className="text-green-500 flex-shrink-0" />
          <span>HD quality output</span>
        </li>
      </ul>

      {/* Price */}
      <div className="mb-4">
        <div className="text-2xl font-black text-gray-900">{displayPrice}</div>
      </div>

      {/* Buy button */}
      <button
        onClick={onBuy}
        disabled={isLoading}
        className={`
          w-full py-3 rounded-xl text-white font-semibold text-sm
          bg-gradient-to-r ${colors.btn}
          hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5
          disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0
          flex items-center justify-center gap-2
        `}
      >
        {isLoading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Sparkles size={14} />
            Buy Now
          </>
        )}
      </button>
    </div>
  );
}

export function CreditStore() {
  const [purchasingPackageId, setPurchasingPackageId] = useState<string | null>(null);
  const { data: packages = [], isLoading: packagesLoading } = usePackages();
  const { data: balance } = useCreditsBalance();
  const { user } = useAuth();
  const { buyCredits, isPending } = useBuyCredits();

  const handleBuy = async (pkg: CreditPackage) => {
    if (!user) return;
    setPurchasingPackageId(pkg.id);
    try {
      await buyCredits(pkg.id, {
        userEmail: user.email ?? undefined,
        userName: user.user_metadata?.display_name ?? user.email?.split('@')[0],
      });
    } finally {
      setPurchasingPackageId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Current Balance Banner */}
      {balance && (
        <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-gray-600">Your Current Balance</p>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Free:</span>
                <span className="text-base font-black text-violet-700">{balance.free_credits_remaining}/3</span>
                <span className="text-xs text-gray-400">(resets monthly)</span>
              </div>
              <div className="w-px h-4 bg-gray-300" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Paid:</span>
                <span className="text-base font-black text-emerald-600">{balance.paid_credits}</span>
                <span className="text-xs text-gray-400">(never expires)</span>
              </div>
            </div>
          </div>
          <Zap size={28} className="text-violet-300 fill-violet-100" />
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
          Buy{' '}
          <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
            Credits
          </span>
        </h2>
        <p className="text-gray-500 text-base">
          Paid credits never expire. Free credits reset every month.
        </p>
      </div>

      {/* Package Cards */}
      {packagesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-96 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No packages available. Check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {packages.map((pkg, idx) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              isPopular={idx === 1} // Middle package marked as popular
              onBuy={() => handleBuy(pkg)}
              isLoading={isPending && purchasingPackageId === pkg.id}
            />
          ))}
        </div>
      )}

      {/* Footer note */}
      <div className="mt-10 text-center">
        <p className="text-xs text-gray-400">
          Secure payments via Razorpay. All transactions encrypted.
          <br />
          1 credit = 1 image generation. Paid credits never expire.
        </p>
      </div>
    </div>
  );
}
