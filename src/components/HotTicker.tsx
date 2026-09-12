"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FeedItem } from "@/lib/sources/types";
import { detailHref } from "@/lib/confluence";
import { SOURCE_LABEL } from "@/lib/format";
import { stashPendingPost } from "@/lib/pendingPost";

export function HotTicker({
  items,
  onOpen,
}: {
  items: FeedItem[];
  onOpen?: (id: string) => void;
}) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);

  if (items.length === 0) return null;

  // Duplicate for seamless loop
  const loop = [...items, ...items];

  function go(item: FeedItem) {
    stashPendingPost(item);
    onOpen?.(item.id);
    router.push(detailHref(item));
  }

  return (
    <div
      className={`glass-panel relative overflow-hidden rounded-xl ${paused ? "ticker-paused" : ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="flex items-stretch">
        <div className="z-10 flex shrink-0 items-center gap-1.5 border-r border-river-accent/20 bg-river-accent/10 px-3 py-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-river-accent opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-river-accent" />
          </span>
          <span className="whitespace-nowrap text-[11px] font-bold tracking-wide text-river-accent">
            熱訊
          </span>
        </div>
        <div className="ticker-mask min-w-0 flex-1 overflow-hidden py-2">
          <div className="animate-ticker flex w-max gap-6 pl-4">
            {loop.map((item, i) => (
              <button
                key={`${item.id}-${i}`}
                type="button"
                onClick={() => go(item)}
                className="group flex max-w-[280px] shrink-0 items-center gap-2 text-left transition hover:opacity-100"
              >
                <span
                  className={`shrink-0 rounded border px-1 py-px text-[9px] font-semibold ${
                    item.source === "ptt"
                      ? "border-river-ptt/40 text-river-ptt"
                      : item.source === "threads"
                        ? "border-river-threads/40 text-river-threads"
                        : "border-river-news/40 text-river-news"
                  }`}
                >
                  {SOURCE_LABEL[item.source] || item.source}
                </span>
                <span className="truncate text-[12px] text-river-muted group-hover:text-river-text">
                  {item.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
