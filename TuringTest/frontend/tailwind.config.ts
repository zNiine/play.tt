import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#e6fbff",
          100: "#b3f3ff",
          200: "#66e8ff",
          300: "#00d4ff",
          400: "#00b8e0",
          500: "#009dc0",
          600: "#007a98",
          700: "#005870",
          800: "#003548",
          900: "#001220",
        },
        neon: {
          green: "#39ff14",
          blue:  "#00d4ff",
          pink:  "#ff0080",
          gold:  "#ffd700",
        },
        surface: {
          50:  "#f0f4ff",
          100: "#e0e8ff",
          200: "#c8d4f0",
          700: "#1a2035",
          800: "#111827",
          900: "#0a0f1e",
          950: "#06091a",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        display: ["var(--font-display)", "sans-serif"],
      },
      backgroundImage: {
        "hero-gradient": "radial-gradient(ellipse at 20% 50%, rgba(0,212,255,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, rgba(57,255,20,0.08) 0%, transparent 60%)",
        "card-shine": "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 50%)",
        "stat-bar": "linear-gradient(90deg, #00d4ff, #39ff14)",
      },
      boxShadow: {
        "neon-blue": "0 0 20px rgba(0,212,255,0.4), 0 0 60px rgba(0,212,255,0.15)",
        "neon-green": "0 0 20px rgba(57,255,20,0.4), 0 0 60px rgba(57,255,20,0.15)",
        "card": "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
        "card-hover": "0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.4s ease-out",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(0,212,255,0.3)" },
          "100%": { boxShadow: "0 0 20px rgba(0,212,255,0.6), 0 0 40px rgba(0,212,255,0.3)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
