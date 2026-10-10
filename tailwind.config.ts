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
          raised: "rgb(var(--river-raised) / <alpha-value>)",
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
        feed: "46rem",
        read: "38rem",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          '"PingFang TC"',
          '"Noto Sans TC"',
          '"Microsoft JhengHei"',
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        soft: "var(--shadow-md)",
      },
    },
  },
  plugins: [],
};

export default config;
