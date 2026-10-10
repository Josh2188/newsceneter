"use client";

import { useEffect, useRef, useState } from "react";

function MenuItem({
  onClick,
  children,
  hint,
  checked,
}: {
  onClick: () => void;
  children: React.ReactNode;
  hint?: string;
  checked?: boolean;
}) {
  return (
    <button
      type="button"
      role={checked === undefined ? "menuitem" : "menuitemcheckbox"}
      aria-checked={checked}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[0.8125rem] text-river-text transition-colors hover:bg-river-raised"
    >
      <span className="w-3.5 text-river-accent" aria-hidden>
        {checked ? "✓" : ""}
      </span>
      <span className="flex-1">{children}</span>
      {hint && (
        <kbd className="rounded border border-river-border px-1.5 text-[0.6875rem] font-sans text-river-muted">
          {hint}
        </kbd>
      )}
    </button>
  );
}

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
  onRefresh,
  refreshing,
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
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const seg = (active: boolean) =>
    `rounded-[5px] px-2.5 py-1 text-[0.75rem] font-medium transition-colors ${
      active
        ? "bg-river-panel text-river-text shadow-[var(--shadow-sm)]"
        : "text-river-muted hover:text-river-text"
    }`;

  return (
    <div ref={wrapRef} className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={onRandomDive}
        className={`rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium text-river-text transition-colors hover:bg-river-raised ${
          diving ? "opacity-60" : ""
        }`}
        title="隨機潛入一則（快捷鍵 r）"
      >
        隨緣一潛
      </button>

      <div
        className="flex items-center rounded-md bg-river-raised p-0.5"
        role="group"
        aria-label="檢視模式"
      >
        <button
          type="button"
          aria-pressed={!imageWall}
          onClick={() => onImageWallChange(false)}
          className={seg(!imageWall)}
        >
          列表
        </button>
        <button
          type="button"
          aria-pressed={imageWall}
          onClick={() => onImageWallChange(true)}
          className={seg(imageWall)}
          title="圖牆模式（快捷鍵 g）"
        >
          圖牆
        </button>
      </div>

      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="更多選項"
        title="更多"
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-river-muted transition-colors hover:bg-river-raised hover:text-river-text"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="currentColor">
          <circle cx="3" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="13" cy="8" r="1.4" />
        </svg>
        {unreadOnly && (
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-river-accent" />
        )}
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="surface fade-rise absolute right-0 top-full z-40 mt-1.5 w-60 rounded-lg p-1 shadow-soft"
        >
          <MenuItem
            checked={unreadOnly}
            onClick={() => onUnreadOnlyChange(!unreadOnly)}
          >
            僅顯示未讀
          </MenuItem>
          <MenuItem
            onClick={() => {
              onClearRead();
              setMenuOpen(false);
            }}
          >
            清除已讀紀錄
          </MenuItem>
          {onCinematicChange && (
            <MenuItem
              hint="d"
              onClick={() => {
                onCinematicChange(!cinematic);
                setMenuOpen(false);
              }}
            >
              夜間漂流（全螢幕輪播）
            </MenuItem>
          )}
          {onRefresh && (
            <MenuItem
              onClick={() => {
                onRefresh();
                setMenuOpen(false);
              }}
            >
              {refreshing ? "整理中…" : "重新整理"}
            </MenuItem>
          )}
          <div className="my-1 border-t border-river-border" />
          <p className="px-2.5 py-1.5 text-[0.6875rem] leading-relaxed text-river-muted">
            快捷鍵：r 隨緣一潛 · g 圖牆 · d 漂流
            <br />
            河道依新到舊排列，來源穿插混入
          </p>
        </div>
      )}
    </div>
  );
}
