"use client";

import { useEffect, useState } from "react";

/** Tiny live indicator of system color scheme (read-only). */
export function ThemeHint() {
  const [scheme, setScheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => setScheme(mq.matches ? "light" : "dark");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border border-river-accent/20 bg-river-accent/5 px-2.5 py-1 text-[10px] text-river-accent sm:inline-flex"
      title="跟隨系統外觀"
    >
      <span aria-hidden>{scheme === "light" ? "☀" : "☾"}</span>
      for Josh · TW · {scheme === "light" ? "日間" : "夜間"}
    </span>
  );
}
