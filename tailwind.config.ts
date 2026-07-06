import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        orange: {
          DEFAULT: "hsl(var(--orange))",
          foreground: "hsl(var(--orange-foreground))",
        },
        purple: {
          DEFAULT: "hsl(var(--purple))",
          foreground: "hsl(var(--purple-foreground))",
        },
        violet: {
          DEFAULT: "#7C3AED",
          light: "#A855F7",
        },
        magenta: {
          DEFAULT: "#EC4899",
        },
        amber: {
          DEFAULT: "#F59E0B",
          warm: "#FB923C",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "1.75rem",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-scale": {
          from: { opacity: "0", transform: "scale(0.95) translateY(10px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(30px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "aurora-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "33%": { backgroundPosition: "50% 100%" },
          "66%": { backgroundPosition: "100% 0%" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6", boxShadow: "0 0 15px rgba(124,58,237,0.2)" },
          "50%": { opacity: "1", boxShadow: "0 0 30px rgba(124,58,237,0.4)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out both",
        "fade-in-scale": "fade-in-scale 0.5s ease-out both",
        "slide-up": "slide-up 0.6s ease-out both",
        "slide-down": "slide-down 0.3s ease-out both",
        float: "float 6s ease-in-out infinite",
        "float-delayed": "float 6s ease-in-out 2s infinite",
        "float-slow": "float 8s ease-in-out 1s infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "spin-slow": "spin-slow 8s linear infinite",
        aurora: "aurora-shift 20s ease-in-out infinite",
        "bounce-subtle": "bounce-subtle 2s ease-in-out infinite",
      },
      backdropBlur: {
        xs: "2px",
        "3xl": "64px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
