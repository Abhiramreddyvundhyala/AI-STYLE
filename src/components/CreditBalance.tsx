/**
 * CreditBalance Component
 * Compact badge shown in the Navbar showing free + paid credits + Buy button.
 */

import { Zap, ShoppingCart } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useCreditsBalance } from '@/hooks/useCredits';

interface CreditBalanceProps {
  compact?: boolean; // Mobile compact mode
}

export function CreditBalance({ compact = false }: CreditBalanceProps) {
  const { data: balance, isLoading } = useCreditsBalance();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 border border-gray-200 animate-pulse">
        <div className="w-16 h-4 bg-gray-200 rounded" />
      </div>
    );
  }

  const free = balance?.free_credits_remaining ?? 0;
  const paid = balance?.paid_credits ?? 0;

  if (compact) {
    return (
      <Link
        to="/credits"
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 hover:border-violet-400 transition-all duration-200 group"
      >
        <Zap size={13} className="text-violet-600 fill-violet-600" />
        <span className="text-xs font-bold text-violet-700">{free + paid}</span>
        <span className="text-xs text-gray-500 font-medium">credits</span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Credit counters */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-100">
        <Zap size={12} className="text-violet-500 fill-violet-500" />
        <span className="text-xs text-gray-500 font-medium">Free:</span>
        <span className="text-xs font-bold text-violet-700">{free}/3</span>

        <span className="w-px h-3 bg-violet-200 mx-0.5" />

        <span className="text-xs text-gray-500 font-medium">Paid:</span>
        <span className="text-xs font-bold text-emerald-600">{paid}</span>
      </div>

      {/* Buy button */}
      <Link
        to="/credits"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-xs font-semibold hover:shadow-lg hover:shadow-violet-500/30 hover:-translate-y-0.5 transition-all duration-200 whitespace-nowrap"
      >
        <ShoppingCart size={12} />
        Buy Credits
      </Link>
    </div>
  );
}
