import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // shadcn-compatible semantic tokens, all light-mode.
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
        // Brand-aligned accents (rose family — matches CosmetWiki).
        rose: {
          500: "#F43F5E",
          600: "#E11D48",
          700: "#BE123C",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out forwards",
      },
      boxShadow: {
        // Neomorphism: a soft outer shadow + a brighter top-left highlight.
        neo: "8px 8px 24px -8px rgba(15,23,42,0.08), -6px -6px 18px -6px rgba(255,255,255,0.95), inset 0 1px 0 rgba(255,255,255,0.75)",
        "neo-sm": "4px 4px 12px -4px rgba(15,23,42,0.06), -3px -3px 8px -3px rgba(255,255,255,0.95)",
        "neo-pressed": "inset 4px 4px 10px -2px rgba(15,23,42,0.10), inset -3px -3px 8px -2px rgba(255,255,255,0.75)",
        // Liquid glass card.
        glass: "0 12px 32px -12px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.85)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
