import { Star, Bookmark, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import type { Style } from "@/hooks/useStyles";
import { useWishlist } from "@/hooks/useWishlist";

export function StyleCard({
  style,
  onClick,
}: {
  style: Style;
  onClick: () => void;
}) {
  const { wishlist, toggleWishlist } = useWishlist();
  const [imageLoaded, setImageLoaded] = useState(false);
  const saved = wishlist.includes(style.id);
  const creatorName = style.seller?.display_name || "Unknown";

  const formatSales = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  return (
    <div className="group relative glass-card glass-card-hover overflow-hidden">
      {/* ─── Bookmark ────────────────────────────────────────── */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleWishlist(style);
        }}
        className={`absolute top-3 right-3 z-10 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
          saved
            ? "bg-violet-DEFAULT/20 border border-violet-DEFAULT/40 shadow-[0_0_12px_rgba(124,58,237,0.3)]"
            : "bg-white/90 backdrop-blur-sm border border-gray-200 hover:bg-white hover:border-gray-300"
        }`}
        aria-label="Save"
      >
        <Bookmark
          size={15}
          className={`transition-all duration-300 ${
            saved
              ? "fill-violet-light text-violet-light scale-110"
              : "text-gray-500"
          }`}
        />
      </button>

      {/* ─── Image ────────────────────────────────────────────── */}
      <button onClick={onClick} className="block w-full text-left">
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
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Category badge */}
          <div className="absolute top-3 left-3 text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur-md border border-gray-200 text-gray-700 font-medium">
            {style.category}
          </div>

          {/* Bottom info overlay */}
          <div className="absolute bottom-3 left-3">
            {/* Price */}
            <div className="text-2xl font-display font-bold text-gray-900 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-200">
              ₹{style.price}
            </div>
          </div>

          {/* Hover CTA */}
          <div className="absolute bottom-3 right-3 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-400 ease-out">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-white border-2 border-gray-900 text-gray-900 shadow-lg hover:bg-gray-900 hover:text-white transition-colors duration-200">
              Try Style <ArrowUpRight size={12} />
            </span>
          </div>
        </div>
      </button>

      {/* ─── Card Footer ──────────────────────────────────────── */}
      <div className="p-4">
        <h3 className="font-display font-semibold text-[15px] text-gray-900 truncate">
          {style.title}
        </h3>

        <div className="mt-3 flex items-center justify-between text-xs">
          {/* Creator */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 shrink-0 rounded-lg bg-gradient-to-br from-violet-DEFAULT to-magenta flex items-center justify-center text-[10px] font-bold text-white">
              {creatorName[0].toUpperCase()}
            </div>
            <span className="text-gray-600 truncate">@{creatorName}</span>
          </div>

          {/* Rating + Sales */}
          <div className="flex items-center gap-2 shrink-0 text-gray-600">
            <div className="flex items-center gap-1">
              <Star
                size={11}
                className="fill-amber-DEFAULT text-amber-DEFAULT"
              />
              <span className="text-gray-700">{style.avg_rating.toFixed(1)}</span>
            </div>
            <span className="text-gray-300">·</span>
            <span>{formatSales(style.sales_count)} sold</span>
          </div>
        </div>
      </div>
    </div>
  );
}
