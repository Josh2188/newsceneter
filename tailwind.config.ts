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
        river: {
          bg: "rgb(var(--river-bg) / <alpha-value>)",
          panel: "rgb(var(--river-panel) / <alpha-value>)",
          border: "rgb(var(--river-border) / <alpha-value>)",
          muted: "rgb(var(--river-muted) / <alpha-value>)",
          text: "rgb(var(--river-text) / <alpha-value>)",
          accent: "rgb(var(--river-accent) / <alpha-value>)",
          warn: "rgb(var(--river-warn) / <alpha-value>)",
          ptt: "rgb(var(--river-ptt) / <alpha-value>)",
          threads: "rgb(var(--river-threads) / <alpha-value>)",
          facebook: "rgb(var(--river-facebook) / <alpha-value>)",
          instagram: "rgb(var(--river-instagram) / <alpha-value>)",
          news: "rgb(var(--river-news) / <alpha-value>)",
        },
      },
      maxWidth: {
        "3xl": "48rem",
        "4xl": "56rem",
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      keyframes: {
        shimmer: {
          "0%, 100%": { backgroundPosition: "0% center" },
          "50%": { backgroundPosition: "100% center" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        shimmer: "shimmer 6s ease-in-out infinite",
        float: "float 4.5s ease-in-out infinite",
      },
      boxShadow: {
        glow: "0 0 28px -8px var(--river-glow)",
        "glow-lg": "0 0 48px -12px var(--river-glow)",
      },
    },
  },
  plugins: [],
};

export default config;
