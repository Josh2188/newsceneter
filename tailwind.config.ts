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
          bg: "#0c0e12",
          panel: "#14181f",
          border: "#252b36",
          muted: "#8b95a8",
          text: "#e8ecf2",
          accent: "#5eead4",
          warn: "#fbbf24",
          ptt: "#86efac",
          threads: "#c4b5fd",
          facebook: "#93c5fd",
          instagram: "#f9a8d4",
          news: "#fdba74",
        },
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
    },
  },
  plugins: [],
};

export default config;
