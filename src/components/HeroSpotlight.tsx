"use client";

import Link from "next/link";
import type { FeedItem } from "@/lib/sources/types";
import type { ConfluenceGroup } from "@/lib/confluence";
import { detailHref } from "@/lib/confluence";
import { formatTime } from "@/lib/format";
import { prefetchPostApi, stashPendingPost } from "@/lib/pendingPost";
import { SourceBadge } from "./SourceBadge";

const GLOW: Record<string, string> = {
  ptt: "source-glow-ptt",
  threads: "source-glow-threads",
  news: "source-glow-news",
};

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
  const eng = item.engagement;
  const engBits: string[] = [];
  if (eng?.pushes) engBits.push(`推 ${eng.pushes}`);
  if (eng?.likes) engBits.push(`♥ ${eng.likes}`);
  if (eng?.comments) engBits.push(`留言 ${eng.comments}`);
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
      className={`group relative block overflow-hidden rounded-2xl glass-panel card-lift fade-rise ${
        GLOW[item.source] || ""
      } ${isRead ? "opacity-[0.6]" : ""}`}
    >
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-river-accent/20 blur-3xl animate-pulse-glow" />
      </div>

      {thumb ? (
        <div className="relative aspect-[21/9] w-full overflow-hidden sm:aspect-[2.4/1]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt=""
            loading="eager"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
          <div className="hero-image-scrim absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-white/80">
              <span className="rounded-full border border-river-accent/40 bg-river-accent/15 px-2 py-0.5 text-[10px] font-semibold text-river-accent shadow-glow">
                精選焦點
              </span>
              <SourceBadge source={item.source} />
              <span className="truncate opacity-80">{item.channel}</span>
              {groupSize >= 2 && (
                <span className="rounded-full border border-river-threads/40 bg-river-threads/15 px-2 py-0.5 text-[10px] text-river-threads">
                  合流 ×{groupSize}
                </span>
              )}
              <span className="ml-auto shrink-0 tabular-nums opacity-70">
                {formatTime(item.createdAt)}
              </span>
            </div>
            <h2 className="text-xl font-bold leading-snug text-white drop-shadow sm:text-2xl">
              {item.title}
            </h2>
            <p className="mt-1.5 line-clamp-2 max-w-2xl text-sm text-white/70">
              {item.preview}
            </p>
            {(engBits.length > 0 || item.author) && (
              <div className="mt-2.5 flex gap-3 text-[11px] text-white/55">
                <span>{item.author}</span>
                {engBits.length > 0 && (
                  <span className="tabular-nums">{engBits.join(" · ")}</span>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="relative p-4 sm:p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-river-muted">
            <span className="rounded-full border border-river-accent/40 bg-river-accent/15 px-2 py-0.5 text-[10px] font-semibold text-river-accent shadow-glow">
              精選焦點
            </span>
            <SourceBadge source={item.source} />
            <span className="truncate">{item.channel}</span>
            {groupSize >= 2 && (
              <span className="rounded-full border border-river-threads/40 bg-river-threads/15 px-2 py-0.5 text-[10px] text-river-threads">
                合流 ×{groupSize}
              </span>
            )}
            <span className="ml-auto shrink-0 tabular-nums">
              {formatTime(item.createdAt)}
            </span>
          </div>
          <h2 className="text-xl font-bold leading-snug text-river-text sm:text-2xl">
            {item.title}
          </h2>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-river-muted">
            {item.preview}
          </p>
          <div className="mt-3 flex gap-3 text-[11px] text-river-muted">
            <span>{item.author}</span>
            {engBits.length > 0 && (
              <span className="ml-auto tabular-nums">{engBits.join(" · ")}</span>
            )}
          </div>
        </div>
      )}
    </Link>
  );
}
