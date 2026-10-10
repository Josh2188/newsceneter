"use client";

import Link from "next/link";
import type { FeedItem } from "@/lib/sources/types";
import type { ConfluenceGroup } from "@/lib/confluence";
import { detailHref } from "@/lib/confluence";
import { prefetchPostApi, stashPendingPost } from "@/lib/pendingPost";
import { MetaLine, engagementBits } from "./FeedCard";

/** Calm featured story: large image, clear title, no overlays. */
export function HeroSpotlight({
  item,
  confluence,
  isRead,
  onOpen,
}: {
  item: FeedItem;
  confluence?: ConfluenceGroup | null;
  isRead?: boolean;
  onOpen?: (id: string) => void;
}) {
  const thumb = item.images?.[0];
  const engBits = engagementBits(item);
  const groupSize = confluence?.memberIds.length ?? 0;

  return (
    <Link
      href={detailHref(item)}
      prefetch
      onClick={() => {
        stashPendingPost(item);
        onOpen?.(item.id);
      }}
      onMouseEnter={() => prefetchPostApi(item)}
      onFocus={() => prefetchPostApi(item)}
      className={`fade-rise group block border-b border-river-border pb-6 ${
        isRead ? "opacity-60" : ""
      }`}
    >
      {thumb && (
        <div className="mb-4 overflow-hidden rounded-xl bg-river-raised">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt=""
            loading="eager"
            referrerPolicy="no-referrer"
            className="aspect-[16/9] w-full object-cover transition-opacity group-hover:opacity-95 sm:aspect-[2/1]"
          />
        </div>
      )}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[0.75rem] font-semibold text-river-accent">精選</span>
        {groupSize >= 2 && (
          <span className="text-[0.75rem] text-river-muted">· 合流 ×{groupSize}</span>
        )}
      </div>
      <MetaLine item={item} isRead={isRead} />
      <h2 className="mt-2 text-[1.375rem] font-semibold leading-snug tracking-[-0.01em] text-river-text group-hover:underline group-hover:decoration-river-border group-hover:underline-offset-4 sm:text-[1.75rem]">
        {item.title}
      </h2>
      {item.preview && (
        <p className="mt-2 line-clamp-3 text-[0.9375rem] leading-relaxed text-river-muted">
          {item.preview}
        </p>
      )}
      {(item.author || engBits.length > 0) && (
        <div className="mt-3 flex items-center gap-2 text-[0.75rem] tabular-nums text-river-muted">
          {item.author && <span>{item.author}</span>}
          {item.author && engBits.length > 0 && <span aria-hidden>·</span>}
          {engBits.length > 0 && <span>{engBits.join("　")}</span>}
        </div>
      )}
    </Link>
  );
}
