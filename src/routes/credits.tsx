/**
 * Credits Page Route
 * /credits — Tabbed page with Store, Transaction History, Generation History
 */

import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ShoppingBag, History, ImageIcon, ArrowLeft, Lock } from 'lucide-react';
import { CreditStore } from '@/components/CreditStore';
import { TransactionHistory } from '@/components/TransactionHistory';
import { GenerationHistory } from '@/components/GenerationHistory';
import { AuthModal } from '@/components/AuthModal';
import { useAuth } from '@/hooks/useAuth';

export const Route = createFileRoute('/credits')({
  component: CreditsPage,
  head: () => ({
    meta: [
      { title: 'Credits — PromptStyle AI' },
      {
        name: 'description',
        content: 'Buy AI image generation credits and view your usage history.',
      },
    ],
  }),
});

type Tab = 'store' | 'transactions' | 'generations';

const TABS: { id: Tab; label: string; icon: typeof ShoppingBag }[] = [
  { id: 'store',        label: 'Buy Credits',         icon: ShoppingBag },
  { id: 'transactions', label: 'Purchase History',     icon: History },
  { id: 'generations',  label: 'Generation History',   icon: ImageIcon },
];

function CreditsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('store');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-fuchsia-50/20">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-0">
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/"
            className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={16} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Credits</h1>
            <p className="text-sm text-gray-500">
              1 credit = 1 AI image generation
            </p>
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-white rounded-2xl border border-gray-100 shadow-sm w-fit">
          {TABS.map(({ id, label, icon: Icon }) => {
            const requiresAuth = id !== 'store';
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => {
                  if (requiresAuth && !isAuthenticated) {
                    setShowAuthModal(true);
                    return;
                  }
                  setActiveTab(id);
                }}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                  ${isActive
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }
                `}
              >
                <Icon size={14} />
                {label}
                {requiresAuth && !isAuthenticated && (
                  <Lock size={11} className="opacity-60" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ───────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4">
        {/* Auth gate for history tabs */}
        {(activeTab === 'transactions' || activeTab === 'generations') && !isAuthenticated ? (
          <div className="py-20 text-center">
            <Lock size={40} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600 font-medium mb-4">
              Sign in to view your history
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Sign In
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'store' && <CreditStore />}
            {activeTab === 'transactions' && isAuthenticated && (
              <div className="py-8">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Purchase History</h2>
                <TransactionHistory />
              </div>
            )}
            {activeTab === 'generations' && isAuthenticated && (
              <div className="py-8">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Generation History</h2>
                <GenerationHistory />
              </div>
            )}
          </>
        )}
      </div>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}
