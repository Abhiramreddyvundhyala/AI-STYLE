import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { StyleCard } from "@/components/StyleCard";
import { StyleModal } from "@/components/StyleModal";
import { useApp } from "@/context/AppContext";
import { useStyles, useStyle } from "@/hooks/useStyles";

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

export const Route = createFileRoute("/explore")({
  component: ExplorePage,
  head: () => ({
    meta: [
      {
        title: "Explore Styles — PromptStyle",
      },
      {
        name: "description",
        content: "Browse and discover amazing AI styles from top creators.",
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

function ExplorePage() {
  const {
    activeCategory,
    setActiveCategory,
    selectedStyleId,
    openStyle,
  } = useApp();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("popular");

  const { data: styles = [], isLoading, isFetching } = useStyles(activeCategory);
  const { data: selectedStyle } = useStyle(selectedStyleId);

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
    return sorted;
  }, [styles, query, sort]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-900">
          Explore Styles
        </h1>
        <p className="text-gray-600 mt-2">
          Discover amazing AI styles from top creators
        </p>
      </div>

      {/* Filters */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
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
      </section>

      {/* Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-gray-200 rounded-2xl mb-3"></div>
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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

      {selectedStyle && (
        <StyleModal style={selectedStyle} onClose={() => openStyle(null)} />
      )}
    </div>
  );
}
