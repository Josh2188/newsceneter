"use client";

import { useEffect, useState } from "react";

export function RiverToolbar({
  onRandomDive,
  unreadOnly,
  onUnreadOnlyChange,
  onClearRead,
  imageWall,
  onImageWallChange,
  diving,
  cinematic,
  onCinematicChange,
}: {
  onRandomDive: () => void;
  unreadOnly: boolean;
  onUnreadOnlyChange: (v: boolean) => void;
  onClearRead: () => void;
  imageWall: boolean;
  onImageWallChange: (v: boolean) => void;
  diving?: boolean;
  cinematic?: boolean;
  onCinematicChange?: (v: boolean) => void;
}) {
  const [hintOpen, setHintOpen] = useState(false);

  useEffect(() => {
    if (!hintOpen) return;
    const t = setTimeout(() => setHintOpen(false), 5000);
    return () => clearTimeout(t);
  }, [hintOpen]);

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onRandomDive}
        className={`rounded-full border border-river-accent/40 bg-river-accent/10 px-3 py-1.5 text-xs font-medium text-river-accent transition hover:bg-river-accent/20 ${
          diving ? "animate-pulse scale-105" : ""
        }`}
        title="隨機潛入一則（快捷鍵 r）"
      >
        隨緣一潛
      </button>

      {onCinematicChange && (
        <button
          type="button"
          onClick={() => onCinematicChange(!cinematic)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            cinematic
              ? "border-river-threads bg-river-threads/15 text-river-threads"
              : "border-river-border bg-river-panel/80 text-river-muted hover:border-river-threads/50 hover:text-river-threads"
          }`}
          title="夜間漂流全螢幕模式（快捷鍵 d）"
        >
          夜間漂流
        </button>
      )}

      <button
        type="button"
        onClick={() => onUnreadOnlyChange(!unreadOnly)}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
          unreadOnly
            ? "border-river-warn bg-river-warn/15 text-river-warn"
            : "border-river-border bg-river-panel/80 text-river-muted hover:border-river-muted hover:text-river-text"
        }`}
      >
        僅未讀
      </button>

      <button
        type="button"
        onClick={onClearRead}
        className="rounded-full border border-river-border bg-river-panel/80 px-3 py-1.5 text-xs text-river-muted transition hover:border-river-muted hover:text-river-text"
        title="清除已讀紀錄"
      >
        清除已讀
      </button>

      <div className="ml-auto flex items-center gap-1 rounded-full border border-river-border bg-river-panel/60 p-0.5">
        <button
          type="button"
          onClick={() => onImageWallChange(false)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
            !imageWall
              ? "bg-river-accent/20 text-river-accent"
              : "text-river-muted hover:text-river-text"
          }`}
        >
          列表
        </button>
        <button
          type="button"
          onClick={() => onImageWallChange(true)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
            imageWall
              ? "bg-river-accent/20 text-river-accent"
              : "text-river-muted hover:text-river-text"
          }`}
          title="圖牆模式（快捷鍵 g）"
        >
          圖牆
        </button>
      </div>

      <button
        type="button"
        onClick={() => setHintOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-river-border text-[11px] text-river-muted hover:border-river-accent hover:text-river-accent"
        aria-label="快捷鍵說明"
        title="快捷鍵"
      >
        ?
      </button>

      {hintOpen && (
        <div className="glass-panel absolute right-0 top-full z-20 mt-1 w-56 rounded-lg px-3 py-2 text-[11px] text-river-muted shadow-lg">
          <p className="mb-1 text-river-muted/80">河道依新到舊排列，來源穿插混入</p>
          <p>
            <kbd className="rounded bg-river-border/80 px-1 font-mono text-river-text">
              r
            </kbd>{" "}
            隨緣一潛
          </p>
          <p className="mt-1">
            <kbd className="rounded bg-river-border/80 px-1 font-mono text-river-text">
              g
            </kbd>{" "}
            切換圖牆
          </p>
          <p className="mt-1">
            <kbd className="rounded bg-river-border/80 px-1 font-mono text-river-text">
              d
            </kbd>{" "}
            夜間漂流
          </p>
        </div>
      )}
    </div>
  );
}
