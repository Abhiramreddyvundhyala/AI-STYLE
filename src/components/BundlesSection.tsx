import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { Loader2, Package } from "lucide-react";

interface Bundle {
  id: number;
  name: string;
  categories: string[];
  count: number;
  price: number;
  discount: number;
  badge: string | null;
}

const bundles: Bundle[] = [
  {
    id: 1,
    name: "Cinematic Pack",
    categories: ["Cinematic"],
    count: 3,
    price: 199,
    discount: 37,
    badge: null,
  },
  {
    id: 2,
    name: "Festival Pack",
    categories: ["Festival", "Wedding"],
    count: 3,
    price: 249,
    discount: 40,
    badge: "Best Value",
  },
  {
    id: 3,
    name: "Viral Creator Pack",
    categories: ["Viral", "Cartoon"],
    count: 3,
    price: 279,
    discount: 36,
    badge: null,
  },
];

export function BundlesSection() {
  const { styles } = useApp();

  if (styles.length === 0) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-violet-light" />
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      {/* Section header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 text-xs text-gray-700 glass-card !rounded-full px-4 py-1.5 mb-4 font-medium">
          <Package size={13} className="text-amber-DEFAULT" />
          Bundle & Save
        </div>
        <h2 className="text-3xl md:text-4xl font-display font-bold text-gray-900">
          Style Bundles
        </h2>
        <p className="text-gray-600 mt-2">
          Curated packs for every kind of creator.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {bundles.map((b) => {
          const items = styles
            .filter((s) => b.categories.includes(s.category))
            .slice(0, b.count);

          if (items.length === 0) return null;

          const original = Math.round(b.price / (1 - b.discount / 100));
          const save = original - b.price;

          return (
            <div
              key={b.id}
              className="relative glass-card glass-card-hover p-6 overflow-hidden"
            >
              {/* Badge */}
              {b.badge && (
                <div className="absolute -top-px left-6 px-3 py-1 rounded-b-lg bg-gradient-to-r from-violet-DEFAULT to-magenta text-white text-[10px] font-bold uppercase tracking-wider shadow-[0_4px_15px_rgba(124,58,237,0.3)]">
                  {b.badge}
                </div>
              )}

              {/* Image stack */}
              <div className="relative h-32 mb-5 mt-2">
                {items.map((it, i) => (
                  <img
                    key={it.id}
                    src={it.sample_image_url}
                    alt={it.title}
                    className="absolute w-24 h-32 object-cover rounded-xl border-2 border-white shadow-xl transition-transform duration-300 hover:scale-105"
                    style={{
                      left: `${i * 50}px`,
                      transform: `rotate(${(i - 1) * 6}deg)`,
                      zIndex: i,
                    }}
                  />
                ))}
              </div>

              <h3 className="text-lg font-display font-bold text-gray-900">
                {b.name}
              </h3>
              <ul className="mt-2 text-xs text-gray-600 space-y-0.5">
                {items.map((it) => (
                  <li key={it.id}>• {it.title}</li>
                ))}
              </ul>

              <div className="mt-4 flex items-end gap-2">
                <span className="text-2xl font-display font-bold gradient-text-warm">
                  ₹{b.price}
                </span>
                <span className="text-sm text-gray-400 line-through mb-0.5">
                  ₹{original}
                </span>
                <span className="ml-auto text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 font-semibold">
                  Save ₹{save}
                </span>
              </div>

              <button
                onClick={() =>
                  toast.info("Bundle checkout coming soon!", {
                    description: b.name,
                  })
                }
                className="mt-5 w-full btn-warm text-sm !py-3"
              >
                Buy Bundle →
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
