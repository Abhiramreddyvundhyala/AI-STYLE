import { Home, Search, Heart, Clock, TrendingUp, Star } from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { useWishlist } from "@/hooks/useWishlist";

export function MobileBottomNav() {
  const { wishlist } = useWishlist();
  const loc = useLocation();
  const isHome = loc.pathname === "/";

  const tabs = [
    {
      icon: Home,
      label: "Home",
      to: "/" as const,
      isActive: isHome,
      isLink: true,
    },
    {
      icon: Search,
      label: "Search",
      href: "#explore",
      isActive: false,
      isLink: false,
    },
    {
      icon: Clock,
      label: "History",
      href: "#history",
      isActive: false,
      isLink: false,
    },
    {
      icon: Heart,
      label: "Favorites",
      href: "#wishlist",
      isActive: false,
      isLink: false,
      badge: wishlist.length,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-[68px] glass-nav border-t border-gray-200 flex items-center justify-around px-2">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const baseClasses = `relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all duration-300 w-14 py-1.5 rounded-xl ${
          tab.isActive
            ? "text-violet-DEFAULT"
            : "text-gray-500 active:scale-95"
        }`;

        const content = (
          <>
            <div className="relative">
              <Icon
                size={20}
                className={`transition-all duration-300 ${
                  tab.isActive ? "drop-shadow-[0_0_8px_rgba(124,58,237,0.6)]" : ""
                }`}
              />
              {tab.badge && tab.badge > 0 && (
                <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-gradient-to-br from-violet-DEFAULT to-magenta text-white text-[8px] font-bold flex items-center justify-center animate-pulse-glow">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="mt-0.5">{tab.label}</span>
            {/* Active dot indicator */}
            {tab.isActive && (
              <div className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-violet-DEFAULT shadow-[0_0_6px_rgba(124,58,237,0.8)]" />
            )}
          </>
        );

        if (tab.isLink && tab.to) {
          return (
            <Link
              key={tab.label}
              to={tab.to}
              className={baseClasses}
            >
              {content}
            </Link>
          );
        }

        return (
          <a
            key={tab.label}
            href={tab.href}
            onClick={(e) => {
              if (!isHome && tab.href) return;
              e.preventDefault();
              const el = document.getElementById(
                tab.href?.replace("#", "") || ""
              );
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className={baseClasses}
          >
            {content}
          </a>
        );
      })}
    </nav>
  );
}
