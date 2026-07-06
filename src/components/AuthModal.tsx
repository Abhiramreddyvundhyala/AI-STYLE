import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Mail, Lock, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function AuthModal({ onClose }: { onClose: () => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSignUp) {
      signUpWithEmail.mutate({ email, password, displayName, isSeller: false });
    } else {
      signInWithEmail.mutate({ email, password });
    }

    onClose();
  };

  const handleGoogleAuth = () => {
    signInWithGoogle.mutate();
    onClose();
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-md mx-auto p-5 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] relative border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >

        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-DEFAULT to-magenta flex items-center justify-center">
                  <Sparkles size={12} className="text-white" />
                </div>
                <span className="text-xs text-gray-600 font-medium">
                  PromptStyle
                </span>
              </div>
              <h2 className="text-xl font-display font-bold text-gray-900">
                {isSignUp ? "Create Account" : "Welcome Back"}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 flex items-center justify-center shrink-0"
              aria-label="Close"
              type="button"
            >
              <X size={16} className="text-gray-600" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="space-y-2.5">
            {isSignUp && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wider">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-DEFAULT/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-DEFAULT/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-DEFAULT/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
                />
              </div>
            </div>


            <button
              type="submit"
              disabled={
                signInWithEmail.isPending || signUpWithEmail.isPending
              }
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-violet-500 to-purple-600 text-white font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {signInWithEmail.isPending || signUpWithEmail.isPending
                ? "Loading..."
                : isSignUp
                  ? "Create Account"
                  : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-gray-500">
                Or continue with
              </span>
            </div>
          </div>

          {/* Google */}
          <button
            onClick={handleGoogleAuth}
            disabled={signInWithGoogle.isPending}
            className="w-full py-2.5 rounded-xl bg-white border-2 border-gray-200 text-gray-800 font-medium hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            type="button"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {signInWithGoogle.isPending ? "Loading..." : "Google"}
          </button>

          {/* Toggle */}
          <div className="mt-3 text-center text-sm text-gray-600">
            {isSignUp
              ? "Already have an account?"
              : "Don't have an account?"}{" "}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-violet-light hover:text-violet-DEFAULT font-medium"
              type="button"
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
