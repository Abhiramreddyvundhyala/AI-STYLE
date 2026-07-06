import { ArrowRight, Zap, Shield, TrendingUp } from "lucide-react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthModal } from "./AuthModal";

const floatingCards = [
  {
    src: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400",
    label: "KGF Cinematic",
    price: "₹99",
    className: "top-6 -left-2 md:left-4 rotate-[-6deg] animate-float z-10",
  },
  {
    src: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400",
    label: "Wedding Glow",
    price: "₹299",
    className: "top-24 right-4 rotate-[5deg] animate-float-delayed z-20",
  },
  {
    src: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400",
    label: "Pixar Avatar",
    price: "₹199",
    className: "bottom-4 left-16 rotate-[3deg] animate-float-slow z-10",
  },
];

const stats = [
  { value: "12K+", label: "Styles Sold" },
  { value: "2.4K", label: "Creators" },
  { value: "4.9★", label: "Avg Rating" },
];

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
      {/* Aurora background */}
      <div className="absolute inset-0 aurora-bg" />

      {/* Gradient mesh shapes */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-violet-DEFAULT/10 blur-[120px] animate-float" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-magenta/8 blur-[100px] animate-float-delayed" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-20 md:pt-28 pb-24 grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* ─── Left: Copy ────────────────────────────────────── */}
        <div className="animate-fade-in">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 text-xs text-gray-700 glass-card !rounded-full px-4 py-1.5 mb-7">
            <Zap size={13} className="text-amber-DEFAULT" />
            <span>India's #1 AI Style Marketplace</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold leading-[1.05] tracking-tight text-gray-900">
            Transform Your
            <br />
            Photo Into{" "}
            <span className="gradient-text">Any Style</span>
          </h1>

          {/* Sub */}
          <p className="mt-6 text-lg text-gray-600 max-w-lg leading-relaxed">
            Browse premium AI styles from creators, upload your photo, and see the magic instantly. Pay only if you love it.
          </p>

          {/* CTAs */}
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to="/explore"
              className="btn-primary inline-flex items-center gap-2 text-base !px-7 !py-3.5"
            >
              Explore Styles <ArrowRight size={18} />
            </Link>
            <button
              onClick={handleStartSelling}
              className="btn-ghost inline-flex items-center gap-2 text-base !px-7 !py-3.5"
            >
              Start Selling
            </button>
          </div>

          {/* Stats */}
          <div className="mt-12 flex items-center gap-6 sm:gap-8">
            {stats.map((s, i) => (
              <div key={s.label} className="flex items-center gap-3">
                {i > 0 && (
                  <div className="w-px h-8 bg-gray-300" />
                )}
                <div className={i > 0 ? "pl-3" : ""}>
                  <div className="text-xl sm:text-2xl font-display font-bold gradient-text-violet">
                    {s.value}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Trust badges */}
          <div className="mt-8 flex items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-1.5">
              <Shield size={12} className="text-emerald-500" />
              Prompts Protected
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} className="text-amber-DEFAULT" />
              65% Creator Revenue
            </div>
          </div>
        </div>

        {/* ─── Right: Floating Gallery ───────────────────────── */}
        <div className="relative h-[440px] hidden md:block animate-fade-in" style={{ animationDelay: "0.2s" }}>
          {/* Glow behind gallery */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-72 h-72 rounded-full bg-violet-DEFAULT/15 blur-[80px]" />
          </div>

          {floatingCards.map((f, i) => (
            <div
              key={i}
              className={`absolute w-52 lg:w-56 glass-card overflow-hidden shadow-2xl transition-transform duration-500 hover:scale-105 ${f.className}`}
            >
              <div className="relative aspect-[3/4] overflow-hidden">
                <img
                  src={f.src}
                  alt={f.label}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>
              <div className="px-3 py-2.5 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-800">{f.label}</span>
                <span className="text-xs font-bold gradient-text-warm">{f.price}</span>
              </div>
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
