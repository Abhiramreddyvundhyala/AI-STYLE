/**
 * Admin Dashboard Route
 *
 * Access is restricted to a hardcoded list of admin emails.
 * Users who are not signed in or whose email is not on the list
 * are shown an "Access Denied" screen — the dashboard never renders.
 */

import { createFileRoute } from '@tanstack/react-router';
import { Shield, Lock, ArrowLeft } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { AdminDashboard } from '@/components/AdminDashboard';
import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from '@/components/AuthModal';
import { useState } from 'react';

// ── Only these emails can access /admin ──────────────────────────────────────
const ADMIN_EMAILS: string[] = [
  'abhiramreddyvundhyala@gmail.com',
];

export const Route = createFileRoute('/admin')({
  component: AdminPage,
});

function AdminPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Not signed in ────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Lock size={28} className="text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Sign in required</h1>
          <p className="text-white/50 text-sm mb-6">
            You need to be signed in with an admin account to access this page.
          </p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold hover:opacity-90 transition-opacity"
          >
            Sign In
          </button>
          <Link to="/" className="mt-4 flex items-center justify-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors">
            <ArrowLeft size={14} /> Back to home
          </Link>
        </div>
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      </div>
    );
  }

  // ── Signed in but NOT an admin email ────────────────────────────────────
  const userEmail = user?.email ?? '';
  const isAdmin = ADMIN_EMAILS.includes(userEmail.toLowerCase());

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Shield size={28} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-white/50 text-sm mb-1">
            You are signed in as:
          </p>
          <p className="text-violet-400 text-sm font-mono mb-6 break-all">
            {userEmail}
          </p>
          <p className="text-white/40 text-xs mb-6">
            This account does not have admin privileges.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors text-sm"
          >
            <ArrowLeft size={14} /> Back to home
          </Link>
        </div>
      </div>
    );
  }

  // ── Admin confirmed — render dashboard ──────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <AdminDashboard />
    </div>
  );
}
