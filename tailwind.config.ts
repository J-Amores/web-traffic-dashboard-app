import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Premium dark rail with depth.
        rail: "#181b23",
        "rail-2": "#1f2330",
        "rail-active": "#2a3142",
        // Light, faintly tinted canvas.
        canvas: "#f5f6fb",
        panel: "#ffffff",
        ink: "#16202e",
        "ink-soft": "#3a475a",
        muted: "#8a93a6",
        // Accent system: blue -> violet / cyan family.
        accent: "#4f7cff",
        "accent-deep": "#3a5bdb",
        violet: "#7c5cff",
        cyan: "#22c4e6",
        up: "#16b364",
        down: "#ef4444",
        grid: "#e9ecf3",
      },
      borderRadius: {
        "2.5xl": "1.25rem",
      },
      boxShadow: {
        // Layered soft elevation for bento tiles.
        tile: "0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -8px rgba(16,24,40,0.10)",
        "tile-lg": "0 1px 3px rgba(16,24,40,0.05), 0 18px 40px -16px rgba(16,24,40,0.16)",
        glow: "0 12px 30px -10px rgba(79,124,255,0.45)",
        panel: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
      },
      backgroundImage: {
        "accent-grad": "linear-gradient(135deg, #4f7cff 0%, #7c5cff 100%)",
        "cyan-grad": "linear-gradient(135deg, #22c4e6 0%, #4f7cff 100%)",
        "canvas-grad":
          "radial-gradient(1200px 600px at 85% -10%, rgba(124,92,255,0.08), transparent 60%), radial-gradient(900px 500px at -5% 5%, rgba(79,124,255,0.07), transparent 55%)",
        "rail-grad": "linear-gradient(180deg, #1f2330 0%, #181b23 55%, #14171f 100%)",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
