import {
  Palette,
  Camera,
  CreditCard,
  Instagram,
  Twitter,
  Youtube,
  ArrowRight,
  Sparkles,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { AuthModal } from "./AuthModal";

/* ═══════════════════════════════════════════════════════════════════════════
   HOW IT WORKS
   ═══════════════════════════════════════════════════════════════════════════ */

const steps = [
  {
    icon: Palette,
    num: "01",
    title: "Browse Styles",
    desc: "Explore hundreds of AI styles from top Indian creators — free to preview.",
    gradient: "from-violet-DEFAULT to-violet-light",
  },
  {
    icon: Camera,
    num: "02",
    title: "Upload Photo",
    desc: "Upload your reference photo and see it transformed in seconds.",
    gradient: "from-magenta to-rose-500",
  },
  {
    icon: CreditCard,
    num: "03",
    title: "Pay & Download",
    desc: "Love the result? Pay and download the full HD version instantly.",
    gradient: "from-amber-DEFAULT to-amber-warm",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 text-xs text-gray-600 glass-card !rounded-full px-4 py-1.5 mb-4">
          <Sparkles size={13} className="text-violet-light" />
          Simple Process
        </div>
        <h2 className="text-3xl md:text-5xl font-display font-bold text-gray-900">
          How It Works
        </h2>
        <p className="text-gray-600 mt-3 max-w-md mx-auto">
          Three simple steps to transform any photo into any style.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 relative">
        {/* Connecting line (desktop) */}
        <div className="hidden md:block absolute top-14 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-violet-DEFAULT/20 via-magenta/20 to-amber-DEFAULT/20" />

        {steps.map((s, i) => (
          <div
            key={i}
            className="glass-card p-7 transition-all duration-400 hover:-translate-y-2 hover:shadow-[0_20px_50px_-15px_rgba(124,58,237,0.15)] group"
          >
            {/* Step number + icon */}
            <div className="flex items-center gap-3 mb-5">
              <div
                className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110`}
              >
                <s.icon size={22} className="text-white" />
              </div>
              <span className="text-xs font-display font-bold text-gray-400 uppercase tracking-widest">
                Step {s.num}
              </span>
            </div>

            <h3 className="text-lg font-display font-bold text-gray-900">
              {s.title}
            </h3>
            <p className="text-gray-600 mt-2 text-sm leading-relaxed">
              {s.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SELLER BANNER
   ═══════════════════════════════════════════════════════════════════════════ */

export function SellerBanner() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleStartSelling = () => {
    if (isAuthenticated) {
      navigate({ to: "/seller-dashboard" });
    } else {
      setShowAuthModal(true);
    }
  };

  const stats = [
    { v: "2,400+", l: "Sellers" },
    { v: "₹18L+", l: "Paid Out" },
    { v: "50K+", l: "Downloads" },
  ];

  return (
    <section id="sell" className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
      <div className="relative overflow-hidden rounded-3xl p-8 md:p-14 glass-card border-violet-DEFAULT/15">
        {/* Background orbs */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-violet-DEFAULT/15 blur-[100px]" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-magenta/10 blur-[100px]" />

        <div className="relative grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-3 py-1.5 mb-5">
              <Shield size={12} className="text-emerald-500" />
              Your prompt stays protected forever
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-bold leading-tight text-gray-900">
              Have a killer
              <br />
              AI style?{" "}
              <span className="gradient-text">Sell it here.</span>
            </h2>
            <p className="mt-5 text-gray-600 max-w-md leading-relaxed">
              Earn 65% on every sale. Your prompt is encrypted and never
              revealed. Join thousands of Indian creators.
            </p>
            <button
              onClick={handleStartSelling}
              className="mt-7 btn-primary inline-flex items-center gap-2 text-base !px-7 !py-3.5"
            >
              Start Selling Free <ArrowRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <div
                key={s.l}
                className="glass-card p-4 text-center transition-all duration-300 hover:-translate-y-1"
              >
                <div className="text-xl md:text-2xl font-display font-bold gradient-text-warm">
                  {s.v}
                </div>
                <div className="text-xs text-gray-500 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════════════════════ */

export function Footer() {
  const links = ["Explore", "Sell", "Pricing", "Blog", "Support"];
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid md:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-DEFAULT to-magenta flex items-center justify-center">
              <Sparkles size={13} className="text-white" />
            </div>
            <span className="font-display text-base font-bold gradient-text">
              PromptStyle
            </span>
          </div>
          <p className="text-sm text-gray-600 max-w-xs leading-relaxed">
            India's premium AI style marketplace. Made for creators, by
            creators.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-3 py-1">
            Made in India 🇮🇳
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 md:justify-center text-sm">
          {links.map((l) => (
            <a
              key={l}
              href="#"
              className="text-gray-600 hover:text-gray-900 transition-colors duration-200"
            >
              {l}
            </a>
          ))}
        </div>

        <div className="flex md:justify-end gap-2.5">
          {[Instagram, Twitter, Youtube].map((Icon, i) => (
            <a
              key={i}
              href="#"
              className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 hover:bg-violet-DEFAULT/15 hover:border-violet-DEFAULT/30 hover:text-violet-light flex items-center justify-center transition-all duration-300 text-gray-600"
            >
              <Icon size={16} />
            </a>
          ))}
        </div>
      </div>
      <div className="text-center text-xs text-gray-400 pb-6">
        © 2026 PromptStyle. All rights reserved.
      </div>
    </footer>
  );
}
