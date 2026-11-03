import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#ed2024",
          50: "#fff1f1",
          100: "#ffdede",
          200: "#ffc2c2",
          300: "#ff9898",
          400: "#ff5d5d",
          500: "#ed2024",
          600: "#d41519",
          700: "#b21014",
          800: "#921114",
          900: "#771416",
          950: "#410507",
        },
        ink: {
          DEFAULT: "#0a0a0a",
          soft: "#1a1a1a",
          muted: "#555",
        },
        paper: {
          DEFAULT: "#fafaf7",
          warm: "#f5f2ea",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        content: ["var(--font-content)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-xl": ["clamp(2.5rem, 5vw, 4.5rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display-lg": ["clamp(2rem, 3.5vw, 3rem)", { lineHeight: "1.1", letterSpacing: "-0.015em" }],
      },
      animation: {
        "marquee": "marquee 45s linear infinite",
        "fade-up": "fadeUp 0.6s ease-out",
        "cookie-in": "cookieIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
        "cookie-out": "cookieOut 0.35s cubic-bezier(0.55, 0, 0.68, 0) both",
        "cookie-wiggle": "cookieWiggle 2.8s ease-in-out infinite",
        "detail-in": "detailIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        cookieIn: {
          "0%": { opacity: "0", transform: "translateY(32px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        cookieOut: {
          "0%": { opacity: "1", transform: "translateY(0) scale(1)" },
          "100%": { opacity: "0", transform: "translateY(24px) scale(0.98)" },
        },
        cookieWiggle: {
          "0%, 88%, 100%": { transform: "rotate(0deg)" },
          "92%": { transform: "rotate(-10deg)" },
          "96%": { transform: "rotate(8deg)" },
        },
        detailIn: {
          "0%": { opacity: "0", maxHeight: "0", transform: "translateY(-6px)" },
          "100%": { opacity: "1", maxHeight: "260px", transform: "translateY(0)" },
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
