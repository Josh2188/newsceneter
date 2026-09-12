"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FeedItem } from "@/lib/sources/types";
import { detailHref } from "@/lib/confluence";
import { formatTime } from "@/lib/format";
import { stashPendingPost } from "@/lib/pendingPost";
import { SourceBadge } from "./SourceBadge";

const INTERVAL_MS = 6000;
const STORAGE_KEY = "newsceneter-cinematic-drift";

export function useCinematicPref(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setOn(true);
    } catch {
      /* ignore */
    }
  }, []);

  const set = useCallback((v: boolean) => {
    setOn(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  return [on, set];
}

export function CinematicDrift({
  items,
  onExit,
  onOpen,
}: {
  items: FeedItem[];
  onExit: () => void;
  onOpen?: (id: string) => void;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = items.length;

  const go = useCallback(
    (dir: 1 | -1) => {
      if (n === 0) return;
      setIndex((i) => (i + dir + n) % n);
    },
    [n],
  );

  useEffect(() => {
    if (paused || n === 0) return;
    const t = setInterval(() => go(1), INTERVAL_MS);
    return () => clearInterval(t);
  }, [paused, n, go, index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        go(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onExit]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (n === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-river-bg/95 p-6">
        <p className="mb-4 text-sm text-river-muted">沒有可漂流的內容</p>
        <button
          type="button"
          onClick={onExit}
          className="rounded-full border border-river-accent/40 px-4 py-2 text-sm text-river-accent"
        >
          離開漂流
        </button>
      </div>
    );
  }

  const item = items[index];
  const thumb = item.images?.[0];

  function openDetail() {
    stashPendingPost(item);
    onOpen?.(item.id);
    onExit();
    router.push(detailHref(item));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-river-bg"
      role="dialog"
      aria-modal="true"
      aria-label="夜間漂流"
      onTouchStart={(e) => {
        touchX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start == null || end == null) return;
        const dx = end - start;
        if (Math.abs(dx) < 50) return;
        go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="absolute inset-0">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id}
            src={thumb}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover fade-rise"
          />
        ) : (
          <div
            key={item.id}
            className="h-full w-full fade-rise"
            style={{
              background:
                "linear-gradient(135deg, rgb(var(--river-bg)), rgb(var(--river-accent) / 0.18), rgb(var(--river-panel)))",
            }}
          />
        )}
        <div className="drift-overlay absolute inset-0" />
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-river-accent/40 bg-river-bg/50 px-2.5 py-1 text-[11px] font-semibold text-river-accent backdrop-blur">
            夜間漂流
          </span>
          <span className="tabular-nums text-[11px] text-river-text/60">
            {index + 1} / {n}
          </span>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="rounded-full border border-river-border bg-river-bg/50 px-3 py-1.5 text-xs text-river-text/80 backdrop-blur hover:border-river-accent hover:text-river-accent"
        >
          離開 Esc
        </button>
      </div>

      <div className="relative z-10 mx-4 mt-3 h-0.5 overflow-hidden rounded-full bg-river-border/60 sm:mx-6">
        <div
          key={`${item.id}-${paused}-${index}`}
          className={`h-full rounded-full bg-river-accent ${paused ? "" : "animate-drift-progress"}`}
          style={{
            width: paused ? "100%" : undefined,
            animationDuration: `${INTERVAL_MS}ms`,
          }}
        />
      </div>

      <div className="relative z-10 mt-auto flex flex-1 flex-col justify-end px-4 pb-6 sm:px-8 sm:pb-10">
        <button type="button" onClick={openDetail} className="max-w-3xl text-left">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SourceBadge source={item.source} />
            <span className="text-xs text-white/80 drop-shadow">{item.channel}</span>
            <span className="text-xs tabular-nums text-white/55 drop-shadow">
              {formatTime(item.createdAt)}
            </span>
          </div>
          <h2 className="text-2xl font-bold leading-snug text-white drop-shadow-lg sm:text-4xl">
            {item.title}
          </h2>
          <p className="mt-3 line-clamp-3 max-w-2xl text-sm leading-relaxed text-white/75 drop-shadow sm:text-base">
            {item.preview}
          </p>
          <p className="mt-3 text-[11px] text-river-accent drop-shadow">
            點擊查看全文 →
          </p>
        </button>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            className="rounded-full border border-white/30 bg-black/25 px-4 py-2 text-sm text-white backdrop-blur hover:border-river-accent dark:bg-black/40"
            aria-label="上一則"
          >
            ← 上一則
          </button>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="rounded-full border border-white/30 bg-black/25 px-4 py-2 text-sm text-white backdrop-blur hover:border-river-accent dark:bg-black/40"
            aria-label={paused ? "繼續" : "暫停"}
          >
            {paused ? "▶ 繼續" : "⏸ 暫停"}
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="rounded-full border border-white/30 bg-black/25 px-4 py-2 text-sm text-white backdrop-blur hover:border-river-accent dark:bg-black/40"
            aria-label="下一則"
          >
            下一則 →
          </button>
          <span className="ml-auto hidden text-[10px] text-white/50 sm:inline">
            空白鍵暫停 · 左右鍵切換 · 滑動亦可
          </span>
        </div>
      </div>
    </div>
  );
}
