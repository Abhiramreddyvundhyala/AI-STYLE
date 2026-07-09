import {
  Upload,
  Wand2,
  ImageIcon,
  Download,
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
    icon: Upload,
    num: "01",
    title: "Upload Selfie",
    desc: "Drop in your photo — any clear selfie works. Our AI handles the rest.",
    gradient: "from-violet-500 to-violet-600",
    accentRing: "rgba(124,58,237,0.25)",
  },
  {
    icon: Wand2,
    num: "02",
    title: "Choose Style",
    desc: "Browse 1,000+ premium AI styles — Cinematic, Wedding, Fashion & more.",
    gradient: "from-pink-500 to-rose-500",
    accentRing: "rgba(236,72,153,0.25)",
  },
  {
    icon: ImageIcon,
    num: "03",
    title: "Generate AI Image",
    desc: "One click. Watch your photo transform into a stunning AI masterpiece.",
    gradient: "from-amber-400 to-orange-500",
    accentRing: "rgba(245,158,11,0.25)",
  },
  {
    icon: Download,
    num: "04",
    title: "Download HD Result",
    desc: "Love it? Purchase and download the full HD image instantly.",
    gradient: "from-emerald-500 to-teal-600",
    accentRing: "rgba(16,185,129,0.25)",
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
          Four simple steps to transform any photo into a stunning AI image.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 relative">
        {/* Connecting line (desktop) */}
        <div className="hidden lg:block absolute top-[3.25rem] left-[12.5%] right-[12.5%] h-px">
          <div
            className="h-full"
            style={{
              background: "linear-gradient(90deg, rgba(124,58,237,0.3) 0%, rgba(236,72,153,0.3) 33%, rgba(245,158,11,0.3) 66%, rgba(16,185,129,0.3) 100%)"
            }}
          />
          {/* Arrow dots on the line */}
          {["25%", "50%", "75%"].map((pos, i) => (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border-2"
              style={{
                left: pos,
                borderColor: ["rgba(124,58,237,0.5)", "rgba(236,72,153,0.5)", "rgba(245,158,11,0.5)"][i]
              }}
            />
          ))}
        </div>

        {steps.map((s, i) => (
          <div
            key={i}
            className="glass-card p-6 transition-all duration-400 hover:-translate-y-2 group relative overflow-hidden"
            style={{ boxShadow: `0 4px 20px ${s.accentRing}` }}
          >
            {/* Subtle inner glow on hover */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none rounded-[1.25rem]"
              style={{ background: `radial-gradient(circle at 30% 30%, ${s.accentRing} 0%, transparent 60%)` }}
            />

            {/* Step icon */}
            <div className="relative flex items-center gap-3 mb-5">
              <div
                className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl`}
              >
                <s.icon size={21} className="text-white" />
              </div>
              <span className="text-[10px] font-display font-bold text-gray-400 uppercase tracking-[0.15em]">
                Step {s.num}
              </span>
            </div>

            <h3 className="relative text-base font-display font-bold text-gray-900">
              {s.title}
            </h3>
            <p className="relative text-gray-500 mt-2 text-sm leading-relaxed">
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
              StyleYourselfAI
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
        © 2026 StyleYourselfAI. All rights reserved.
      </div>
    </footer>
  );
}
