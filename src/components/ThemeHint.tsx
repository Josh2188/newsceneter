"use client";

import { useEffect, useState } from "react";

/** Tiny read-only indicator that colors follow the system appearance. */
export function ThemeHint() {
  const [scheme, setScheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => setScheme(mq.matches ? "light" : "dark");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (!scheme) return null;
  return (
    <span
      className="hidden text-[0.75rem] text-river-muted sm:inline"
      title="配色跟隨系統外觀"
    >
      {scheme === "light" ? "日間" : "夜間"} · 跟隨系統
    </span>
  );
}
