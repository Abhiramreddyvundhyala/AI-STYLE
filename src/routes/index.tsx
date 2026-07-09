import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Search, X, SlidersHorizontal, ArrowRight } from "lucide-react";
import { Hero } from "@/components/Hero";
import { StyleCard } from "@/components/StyleCard";
import { StyleModal } from "@/components/StyleModal";
import { TrendingRow } from "@/components/TrendingRow";
import { HowItWorks, Footer } from "@/components/Sections";
import { useApp } from "@/context/AppContext";
import { useStyles, useStyle } from "@/hooks/useStyles";
import { AuthModal } from "@/components/AuthModal";
import { useWishlist } from "@/hooks/useWishlist";
import { useFollows } from "@/hooks/useFollows";

const categories = [
  "All",
  "Cinematic",
  "Bollywood",
  "Cartoon",
  "Wedding",
  "Festival",
  "Business",
  "Viral",
  "Portrait",
];

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      {
        title: "StyleYourselfAI — Transform Yourself Into Any AI Style",
      },
      {
        name: "description",
        content:
          "India's #1 AI style marketplace. Buy premium AI styles, upload your photo, see the magic instantly.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
});

type SortKey = "popular" | "newest" | "price_asc" | "price_desc" | "rating";
const sortOptions: { v: SortKey; label: string }[] = [
  { v: "newest", label: "Newest" },
  { v: "popular", label: "Popular" },
  { v: "price_asc", label: "Price: Low → High" },
  { v: "price_desc", label: "Price: High → Low" },
  { v: "rating", label: "Top Rated" },
];

function Index() {
  const {
    activeCategory,
    setActiveCategory,
    selectedStyleId,
    openStyle,
    setStyles,
  } = useApp();
  
  // Use Supabase-backed hooks for wishlist and follows
  const { wishlist, toggleWishlist } = useWishlist();
  const { follows, toggleFollow } = useFollows();
  
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("popular");
  const [showAuthModal, setShowAuthModal] = useState(false);

  const { data: styles = [] } = useStyles(activeCategory);
  // Fetch ALL styles (no category filter) so wishlist works across all categories
  const { data: allStyles = [] } = useStyles("All");
  const { data: selectedStyle } = useStyle(selectedStyleId);

  useEffect(() => {
    if (styles.length > 0) {
      setStyles(styles);
    }
  }, [styles, setStyles]);

  const filtered = useMemo(() => {
    let list = [...styles];

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          (s.seller?.display_name &&
            s.seller.display_name.toLowerCase().includes(q))
      );
    }

    const sorted = [...list];
    switch (sort) {
      case "newest":
        sorted.sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );
        break;
      case "price_asc":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        sorted.sort((a, b) => b.avg_rating - a.avg_rating);
        break;
      default:
        sorted.sort((a, b) => b.sales_count - a.sales_count);
    }
    
    // Return top 10 only
    return sorted.slice(0, 10);
  }, [styles, query, sort]);

  const wishlistItems = allStyles.filter((s) => wishlist.includes(s.id));

  return (
    <>
      <Hero />
      <TrendingRow />

      {/* ─── Saved Styles ────────────────────────────────────── */}
      {wishlistItems.length > 0 && (
        <section id="wishlist" className="max-w-7xl mx-auto px-4 sm:px-6 pt-12">
          <h2 className="text-lg md:text-xl font-display font-bold mb-4 text-gray-900">
            Your Favorites
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({wishlistItems.length})
            </span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {wishlistItems.map((s) => (
              <StyleCard
                key={s.id}
                style={s}
                onClick={() => openStyle(s.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ─── History Section ─────────────────────────────────── */}
      <section id="history" className="max-w-7xl mx-auto px-4 sm:px-6 pt-12">
        <h2 className="text-lg md:text-xl font-display font-bold mb-4 text-gray-900">
          Recently Viewed
        </h2>
        <div className="glass-card p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center">
            <span className="text-xl">🕐</span>
          </div>
          <p className="text-sm text-gray-600">Your browsing history will appear here</p>
        </div>
      </section>

      {/* ─── Filters & Top 10 Styles ─────────────────────────────────── */}
      <section id="explore" className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-8">
        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-none">
          {categories.map((c) => {
            const isActive = activeCategory === c;
            return (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-gray-900 text-white shadow-lg"
                    : "bg-white text-gray-700 border border-gray-300 hover:border-gray-900 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>

        {/* Search + Sort */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-violet-light transition-colors duration-200"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search styles... e.g. KGF, Wedding, Cartoon"
              className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-10 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-DEFAULT/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)] transition-all duration-300"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 transition-colors"
                aria-label="Clear"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="relative">
            <SlidersHorizontal
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full sm:w-auto appearance-none bg-white border border-gray-200 rounded-xl pl-9 pr-8 py-3 text-sm text-gray-700 focus:outline-none focus:border-violet-DEFAULT/40 transition-all cursor-pointer"
            >
              {sortOptions.map((o) => (
                <option
                  key={o.v}
                  value={o.v}
                  className="bg-white text-gray-900"
                >
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Top 10 Styles Grid with View All Button */}
        <div className="mt-6 flex items-center justify-between mb-4">
          <h3 className="text-xl font-display font-bold text-gray-900">
            Top 10 {activeCategory !== "All" ? activeCategory : ""} Styles
          </h3>
          <Link
            to="/explore"
            className="text-sm text-violet-600 hover:text-violet-700 font-medium inline-flex items-center gap-1"
          >
            View All <ArrowRight size={14} />
          </Link>
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {filtered.map((s) => (
              <StyleCard
                key={s.id}
                style={s}
                onClick={() => openStyle(s.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 animate-fade-in-scale">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
              <span className="text-2xl">🔍</span>
            </div>
            <div className="text-gray-600 font-medium">
              No styles found{query ? ` for "${query}"` : ""}
            </div>
            <button
              onClick={() => {
                setQuery("");
                setActiveCategory("All");
              }}
              className="mt-5 btn-primary text-sm"
            >
              Clear Search
            </button>
          </div>
        )}
      </section>

      <HowItWorks />
      <Footer />

      {selectedStyle && (
        <StyleModal style={selectedStyle} onClose={() => openStyle(null)} />
      )}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </>
  );
}
