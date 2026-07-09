import { ArrowRight, Sparkles, Star, Shield, Zap, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthModal } from "./AuthModal";
import { useNavigate } from "@tanstack/react-router";

/* ─── Style category pills (no images) ─────────────────────────────────── */
const styleCategories = [
  { label: "Cinematic", emoji: "🎬", color: "rgba(124,58,237,0.12)", border: "rgba(124,58,237,0.25)", text: "#6d28d9" },
  { label: "Wedding", emoji: "💍", color: "rgba(236,72,153,0.10)", border: "rgba(236,72,153,0.25)", text: "#be185d" },
  { label: "Magazine", emoji: "📸", color: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)", text: "#b45309" },
  { label: "Fashion", emoji: "👗", color: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.25)", text: "#065f46" },
  { label: "Sports", emoji: "🏆", color: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.25)", text: "#1e40af" },
  { label: "Bollywood", emoji: "🎭", color: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.25)", text: "#991b1b" },
  { label: "Cartoon", emoji: "🎨", color: "rgba(168,85,247,0.10)", border: "rgba(168,85,247,0.25)", text: "#6b21a8" },
  { label: "Business", emoji: "💼", color: "rgba(71,85,105,0.10)", border: "rgba(71,85,105,0.25)", text: "#334155" },
];



/* ─── Trust badges ──────────────────────────────────────────────────────── */
const trustBadges = [
  { icon: "🖼️", value: "25,000+", label: "Images Generated" },
  { icon: "👤", value: "5,000+", label: "Happy Users" },
  { icon: "✨", value: "1,000+", label: "AI Styles" },
  { icon: "⭐", value: "4.9", label: "Rating" },
];

/* ─── Hero ──────────────────────────────────────────────────────────────── */
export function Hero() {
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

  return (
    <section className="relative overflow-hidden">

      {/* ── Background: aurora mesh (matches app theme) ──────────────── */}
      <div className="absolute inset-0 aurora-bg" />

      {/* Soft gradient orbs — no photos, pure color */}
      <div
        className="absolute top-[-8%] left-[-5%] w-[550px] h-[550px] rounded-full pointer-events-none animate-blob-1"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.13) 0%, transparent 65%)", filter: "blur(90px)" }}
      />
      <div
        className="absolute top-[20%] right-[-8%] w-[450px] h-[450px] rounded-full pointer-events-none animate-blob-2"
        style={{ background: "radial-gradient(circle, rgba(236,72,153,0.09) 0%, transparent 65%)", filter: "blur(80px)" }}
      />
      <div
        className="absolute bottom-0 left-[40%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 65%)", filter: "blur(80px)" }}
      />

      {/* ════════════════════════════════════════════════════════════════
          TOP HERO — CENTERED
      ════════════════════════════════════════════════════════════════ */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 md:pt-28 pb-12">

        {/* ── Eyebrow badge ─────────────────────────────────────────── */}
        <div className="flex justify-center mb-8 animate-text-reveal">
          <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full glass-card !rounded-full border">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-500 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-600" />
            </span>
            <span className="text-sm font-semibold text-gray-700">India's #1 AI Style Platform</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">NEW</span>
          </div>
        </div>

        {/* ── Headline — centered, very large ───────────────────────── */}
        <div className="text-center">
          <div className="overflow-hidden">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-bold leading-[1.0] tracking-tighter text-gray-900 animate-text-reveal delay-100">
              Transform Yourself
            </h1>
          </div>
          <div className="overflow-hidden mt-1">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-bold leading-[1.0] tracking-tighter animate-text-reveal delay-200">
              Into{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 35%, #ec4899 65%, #f59e0b 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Any AI Style
              </span>
            </h1>
          </div>
        </div>

        {/* ── Subtitle ──────────────────────────────────────────────── */}
        <p className="mt-7 text-center text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed animate-text-reveal delay-300">
          Upload your photo · Choose from{" "}
          <span className="font-semibold text-gray-900">1,000+ premium AI styles</span>{" "}
          · Get stunning images{" "}
          <span className="font-semibold text-gray-900">instantly</span>.
          Pay only for what you love.
        </p>

        {/* ── CTAs ──────────────────────────────────────────────────── */}
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4 animate-text-reveal delay-400">
          <Link
            to="/explore"
            id="hero-cta-primary"
            className="btn-hero-primary inline-flex items-center gap-2.5 animate-hero-glow"
          >
            <Sparkles size={19} />
            Generate Your First Style
            <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            to="/explore"
            id="hero-cta-secondary"
            className="btn-hero-ghost inline-flex items-center gap-2"
          >
            Browse Marketplace
            <ArrowRight size={15} />
          </Link>
        </div>

        {/* ── Social proof row ──────────────────────────────────────── */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 animate-text-reveal delay-500">
          {/* Avatars */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2.5">
              {[
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&q=80",
                "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=64&q=80",
                "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=64&q=80",
                "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=64&q=80",
              ].map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                  loading="lazy"
                />
              ))}
            </div>
            <span className="text-sm text-gray-600">
              <span className="font-bold text-gray-900">5,000+</span> creators styling themselves
            </span>
          </div>
          {/* Stars */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
            ))}
            <span className="text-sm font-semibold text-gray-700 ml-1">4.9 / 5</span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          STYLE CATEGORIES ROW (no photos — just pill tags)
      ════════════════════════════════════════════════════════════════ */}
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 animate-text-reveal delay-500">
        <div className="flex flex-wrap justify-center gap-3">
          {styleCategories.map((cat) => (
            <Link
              to="/explore"
              key={cat.label}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-sm transition-all duration-300 hover:-translate-y-1"
              style={{
                background: cat.color,
                border: `1px solid ${cat.border}`,
                color: cat.text,
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              }}
            >
              <span className="text-base">{cat.emoji}</span>
              {cat.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          TRUST STAT BADGES
      ════════════════════════════════════════════════════════════════ */}
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {trustBadges.map((b) => (
            <div
              key={b.label}
              className="glass-card p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="text-2xl mb-1">{b.icon}</div>
              <div
                className="text-xl font-display font-bold"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {b.value}
              </div>
              <div className="text-xs text-gray-500 mt-0.5 font-medium">{b.label}</div>
            </div>
          ))}
        </div>

        {/* Bottom trust row */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
          {[
            { icon: Shield, text: "Secure Payments", color: "text-emerald-500" },
            { icon: Zap, text: "Instant Generation", color: "text-amber-500" },
            { icon: CheckCircle2, text: "Prompt Protected", color: "text-violet-600" },
          ].map(({ icon: Icon, text, color }) => (
            <div key={text} className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Icon size={14} className={color} />
              {text}
            </div>
          ))}
        </div>
      </div>

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </section>
  );
}
