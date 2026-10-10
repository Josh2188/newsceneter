"use client";

import Link from "next/link";
import type { FeedItem } from "@/lib/sources/types";
import { detailHref } from "@/lib/confluence";
import { SOURCE_DOT_CLASS } from "@/lib/format";
import { prefetchPostApi, stashPendingPost } from "@/lib/pendingPost";

/** Understated "熱門" row: numbered titles, horizontally scrollable. */
export function HotTicker({
  items,
  onOpen,
}: {
  items: FeedItem[];
  onOpen?: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section
      aria-label="熱門"
      className="flex items-center gap-3 border-y border-river-border py-2.5"
    >
      <span className="shrink-0 text-[0.75rem] font-semibold text-river-text">
        熱門
      </span>
      <ol className="scrollbar-none flex min-w-0 flex-1 snap-x gap-5 overflow-x-auto">
        {items.map((item, i) => (
          <li key={item.id} className="shrink-0 snap-start">
            <Link
              href={detailHref(item)}
              prefetch={false}
              onClick={() => {
                stashPendingPost(item);
                onOpen?.(item.id);
              }}
              onMouseEnter={() => prefetchPostApi(item)}
              className="group flex max-w-[16rem] items-center gap-2 text-[0.8125rem]"
            >
              <span className="tabular-nums text-river-muted">{i + 1}</span>
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  SOURCE_DOT_CLASS[item.source] || "bg-river-muted"
                }`}
                aria-hidden
              />
              <span className="truncate text-river-text/85 group-hover:text-river-text group-hover:underline group-hover:underline-offset-2">
                {item.title}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
