import { Star, Flame, Loader2, TrendingUp, Bookmark } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useTrendingStyles } from "@/hooks/useStyles";
import { useWishlist } from "@/hooks/useWishlist";
import { useState } from "react";
import type { Style } from "@/hooks/useStyles";

/* ─── Single Trending Card (matches StyleCard proportions) ──────────────── */
function TrendingCard({ style, index }: { style: Style; index: number }) {
  const { openStyle } = useApp();
  const { wishlist, toggleWishlist } = useWishlist();
  const [imageLoaded, setImageLoaded] = useState(false);
  const saved = wishlist.includes(style.id);
  const creatorName = style.seller?.display_name || "Unknown";

  const formatSales = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  return (
    <div className="snap-start shrink-0 w-44 sm:w-48 group relative glass-card glass-card-hover overflow-hidden">

      {/* ─── Bookmark ──────────────────────────────────────────── */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleWishlist(style);
        }}
        className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
          saved
            ? "bg-violet-DEFAULT/20 border border-violet-DEFAULT/40 shadow-[0_0_12px_rgba(124,58,237,0.3)]"
            : "bg-white/90 backdrop-blur-sm border border-gray-200 hover:bg-white"
        }`}
        aria-label="Save"
      >
        <Bookmark
          size={13}
          className={saved ? "fill-violet-light text-violet-light" : "text-gray-500"}
        />
      </button>

      {/* ─── Image + overlays ──────────────────────────────────── */}
      <button onClick={() => openStyle(style.id)} className="block w-full text-left">
        <div className="relative overflow-hidden aspect-[4/5] bg-gray-100">

          {/* Loading skeleton */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse" />
          )}

          <img
            src={style.sample_image_url}
            alt={style.title}
            onLoad={() => setImageLoaded(true)}
            className={`w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Trending badge — bottom right */}
          <div className="absolute bottom-3 right-3 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-400/20 backdrop-blur-sm border border-amber-400/30 text-amber-600 font-bold flex items-center gap-1">
            <Flame size={8} /> HOT
          </div>
        </div>

        {/* ─── Card Footer ───────────────────────────────────────── */}
        <div className="p-3">
          <h3 className="font-display font-semibold text-[13px] text-gray-900 truncate">
            {style.title}
          </h3>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-gray-500 truncate">@{creatorName}</span>
            <div className="flex items-center gap-1 shrink-0 text-gray-600 ml-2">
              <Star size={10} className="fill-amber-400 text-amber-400" />
              <span>{style.avg_rating.toFixed(1)}</span>
              <span className="text-gray-300">·</span>
              <span>{formatSales(style.sales_count)} sold</span>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

/* ─── TrendingRow ───────────────────────────────────────────────────────── */
export function TrendingRow() {
  const { data: trending = [], isLoading } = useTrendingStyles(5);

  if (isLoading) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12">
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-violet-light" />
        </div>
      </section>
    );
  }

  if (trending.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12">
      {/* ─── Section Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-DEFAULT/20 to-amber-warm/10 border border-amber-DEFAULT/20 flex items-center justify-center">
            <Flame className="text-amber-DEFAULT" size={18} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-display font-bold text-gray-900">
              Trending This Week
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Top styles by sales</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500">
          <TrendingUp size={12} />
          Updated live
        </div>
      </div>

      {/* ─── Scroll Row ──────────────────────────────────────── */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-none snap-x">
        {trending.map((s, index) => (
          <TrendingCard key={s.id} style={s} index={index} />
        ))}
      </div>
    </section>
  );
}
