import { useState } from "react";
import { Menu, X, ChevronDown, LogOut, User, Sparkles } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { AuthModal } from "./AuthModal";
import { CreditBalance } from "./CreditBalance";
import { toast } from "sonner";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut.mutate();
    setProfileOpen(false);
  };

  const handleStartSelling = () => {
    if (isAuthenticated) {
      navigate({ to: "/seller-dashboard" });
    } else {
      setShowAuthModal(true);
    }
  };

  const handleDashboard = () => {
    if (isAuthenticated) {
      const isSeller = user?.user_metadata?.is_seller;
      if (isSeller) {
        navigate({ to: "/seller-dashboard" });
      } else {
        toast.error("Access denied", {
          description: "Only seller accounts can access the dashboard",
        });
      }
    } else {
      setShowAuthModal(true);
    }
  };

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Explore", href: "/explore" },
    { label: "Sell", href: "/#sell" },
    { label: "How it Works", href: "/#how" },
  ];

  return (
    <header className="sticky top-0 z-30 glass-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* ─── Logo ──────────────────────────────────────────── */}
        <Link
          to="/"
          className="flex items-center gap-2.5 group"
        >
          <div className="relative w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
            <Sparkles size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-gray-900">
            StyleYourselfAI
          </span>
        </Link>

        {/* ─── Desktop Nav ───────────────────────────────────── */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isExternal = link.href.startsWith('/#');
            const isExplore = link.href === '/explore';
            const isHome = link.href === '/';
            
            if (isExternal) {
              return (
                <a
                  key={link.label}
                  href={link.href}
                  className="relative px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200 group"
                >
                  {link.label}
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-violet-DEFAULT to-magenta scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" />
                </a>
              );
            }
            
            return (
              <Link
                key={link.label}
                to={link.href as '/' | '/explore'}
                className="relative px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200 group"
              >
                {link.label}
                <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-violet-DEFAULT to-magenta scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" />
              </Link>
            );
          })}

          {/* Tools dropdown */}
          <div className="relative" onMouseLeave={() => setToolsOpen(false)}>
            <button
              onClick={() => setToolsOpen((o) => !o)}
              onMouseEnter={() => setToolsOpen(true)}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Tools{" "}
              <ChevronDown
                size={14}
                className={toolsOpen ? "rotate-180" : ""}
              />
            </button>
            {toolsOpen && (
              <div className="absolute top-full left-0 mt-1 w-56 glass-card p-1.5 shadow-2xl">
                <Link
                  to="/tools/product-upgrader"
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                  onClick={() => setToolsOpen(false)}
                >
                  <span className="text-base">📸</span>
                  Product Photo Upgrader
                </Link>
                <a
                  href="/gemini-demo"
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                  onClick={() => setToolsOpen(false)}
                >
                  <span className="text-base">✨</span>
                  AI Image Generator
                </a>
              </div>
            )}
          </div>
        </nav>

        {/* ─── Desktop Actions ───────────────────────────────── */}
        <div className="hidden md:flex items-center gap-2.5">

          {isAuthenticated ? (
            <>
              {/* Credit Balance Badge */}
              <CreditBalance />

              <div className="relative" onMouseLeave={() => setProfileOpen(false)}>
                <button
                  onClick={() => setProfileOpen((o) => !o)}
                  onMouseEnter={() => setProfileOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 border border-gray-200 hover:border-violet-DEFAULT/30"
                >
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-DEFAULT to-magenta flex items-center justify-center">
                    <User size={12} className="text-white" />
                  </div>
                  <span className="text-sm text-gray-800 max-w-[120px] truncate">
                    {user?.email?.split("@")[0]}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-gray-500 ${profileOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {profileOpen && (
                  <div className="absolute top-full right-0 mt-1 w-48 glass-card p-1.5 shadow-2xl">
                    {user?.user_metadata?.is_seller && (
                      <Link
                        to="/seller-dashboard"
                        className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                        onClick={() => setProfileOpen(false)}
                      >
                        <User size={14} />
                        Dashboard
                      </Link>
                    )}
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={handleStartSelling}
                className="btn-ghost text-sm !py-2 !px-4"
              >
                Start Selling
              </button>
              <button
                onClick={() => setShowAuthModal(true)}
                className="btn-primary text-sm !py-2 !px-4"
              >
                Sign In
              </button>
            </>
          )}
        </div>

        {/* ─── Mobile Hamburger ──────────────────────────────── */}
        <button
          className="md:hidden w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* ─── Mobile Menu ─────────────────────────────────────── */}
      {open && (
        <div className="md:hidden border-t border-gray-200 bg-white/95 backdrop-blur-xl px-4 py-5 space-y-1">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="block px-3 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Link
            to="/tools/product-upgrader"
            className="block px-3 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            onClick={() => setOpen(false)}
          >
            Product Upgrader
          </Link>
          <a
            href="/gemini-demo"
            className="block px-3 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            onClick={() => setOpen(false)}
          >
            AI Image Generator
          </a>
          {/* Mobile Credit Balance */}
          {isAuthenticated && (
            <div className="px-3 py-2">
              <CreditBalance compact />
            </div>
          )}

          {isAuthenticated && user?.user_metadata?.is_seller && (
            <Link
              to="/seller-dashboard"
              className="block px-3 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              onClick={() => setOpen(false)}
            >
              Seller Dashboard
            </Link>
          )}

          <div className="pt-3 border-t border-gray-200 mt-3 flex gap-2">
            {isAuthenticated ? (
              <button
                onClick={() => {
                  handleSignOut();
                  setOpen(false);
                }}
                className="flex-1 btn-ghost text-sm !py-2.5 flex items-center justify-center gap-2"
              >
                <LogOut size={14} /> Sign Out
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    handleStartSelling();
                    setOpen(false);
                  }}
                  className="flex-1 btn-ghost text-sm !py-2.5"
                >
                  Start Selling
                </button>
                <button
                  onClick={() => {
                    setShowAuthModal(true);
                    setOpen(false);
                  }}
                  className="flex-1 btn-primary text-sm !py-2.5"
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </header>
  );
}
