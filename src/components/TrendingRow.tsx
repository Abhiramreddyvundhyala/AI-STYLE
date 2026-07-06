import { Star, Flame, Loader2, TrendingUp } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useTrendingStyles } from "@/hooks/useStyles";

export function TrendingRow() {
  const { openStyle } = useApp();
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

  const formatSales = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

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
          <button
            key={s.id}
            onClick={() => openStyle(s.id)}
            className="snap-start shrink-0 w-72 md:w-80 group text-left glass-card overflow-hidden transition-all duration-400 hover:-translate-y-2 hover:shadow-[0_20px_50px_-15px_rgba(124,58,237,0.2)]"
          >
            <div className="relative aspect-[16/10] overflow-hidden">
              <img
                src={s.sample_image_url}
                alt={s.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#08080C] via-[#08080C]/30 to-transparent" />

              {/* Rank badge */}
              <div className="absolute top-3 left-3 w-9 h-9 rounded-xl bg-gradient-to-br from-amber-DEFAULT to-amber-warm text-[#08080C] font-display font-bold text-lg flex items-center justify-center shadow-[0_4px_15px_rgba(245,158,11,0.4)]">
                {index + 1}
              </div>

              {/* Trending label */}
              <div className="absolute top-3 right-3 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-DEFAULT/15 backdrop-blur-sm border border-amber-DEFAULT/25 text-amber-DEFAULT font-bold flex items-center gap-1">
                <Flame size={9} /> Trending
              </div>

              {/* Bottom info */}
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                <div>
                  <div className="font-display font-bold text-white text-sm">
                    {s.title}
                  </div>
                  <div className="text-xs text-white/80 flex items-center gap-1.5 mt-0.5">
                    <Star
                      size={10}
                      className="fill-amber-DEFAULT text-amber-DEFAULT"
                    />{" "}
                    {s.avg_rating.toFixed(1)} · {formatSales(s.sales_count)} sold
                  </div>
                </div>
                <div className="text-lg font-display font-bold gradient-text-warm">
                  ₹{s.price}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
