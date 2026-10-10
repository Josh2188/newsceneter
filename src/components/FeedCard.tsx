"use client";

import { useState } from "react";
import Link from "next/link";
import type { FeedItem } from "@/lib/sources/types";
import type { ConfluenceGroup } from "@/lib/confluence";
import { detailHref } from "@/lib/confluence";
import { formatTime } from "@/lib/format";
import { prefetchPostApi, stashPendingPost } from "@/lib/pendingPost";
import { SourceBadge } from "./SourceBadge";

export function engagementBits(item: FeedItem): string[] {
  const eng = item.engagement;
  const bits: string[] = [];
  if (eng?.pushes) bits.push(`推 ${eng.pushes}`);
  if (eng?.boos) bits.push(`噓 ${eng.boos}`);
  if (eng?.likes) bits.push(`♥ ${eng.likes}`);
  if (eng?.comments && !eng.pushes) bits.push(`留言 ${eng.comments}`);
  return bits;
}

export function MetaLine({
  item,
  isRead,
  tone = "default",
}: {
  item: FeedItem;
  isRead?: boolean;
  tone?: "default" | "onImage";
}) {
  const muted = tone === "onImage" ? "text-white/70" : "text-river-muted";
  return (
    <div className={`flex min-w-0 items-center gap-1.5 text-[0.75rem] ${muted}`}>
      <SourceBadge source={item.source} tone={tone} />
      {item.channel && (
        <>
          <span aria-hidden>·</span>
          <span className="truncate">{item.channel}</span>
        </>
      )}
      {item.createdAt && (
        <>
          <span aria-hidden>·</span>
          <span className="shrink-0 tabular-nums">{formatTime(item.createdAt)}</span>
        </>
      )}
      {isRead && <span className="ml-1 shrink-0">已讀</span>}
    </div>
  );
}

export function FeedCard({
  item,
  confluence,
  siblings,
  isRead,
  onOpen,
  featured,
  index = 0,
}: {
  item: FeedItem;
  confluence?: ConfluenceGroup | null;
  siblings?: FeedItem[];
  isRead?: boolean;
  onOpen?: (id: string) => void;
  featured?: boolean;
  index?: number;
}) {
  const [open, setOpen] = useState(false);
  const engBits = engagementBits(item);
  const thumb = item.images?.[0];
  const groupSize = confluence?.memberIds.length ?? 0;
  const others = siblings?.filter((s) => s.id !== item.id) || [];
  const delay = Math.min(index, 10) * 20;

  return (
    <div
      className={`fade-rise border-b border-river-border/70 py-1 transition-opacity ${
        isRead ? "opacity-[0.55]" : ""
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <Link
        href={detailHref(item)}
        prefetch
        onClick={() => {
          stashPendingPost(item);
          onOpen?.(item.id);
        }}
        onMouseEnter={() => prefetchPostApi(item)}
        onFocus={() => prefetchPostApi(item)}
        className="-mx-3 flex gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-river-text/[0.035]"
      >
        <div className="min-w-0 flex-1">
          <MetaLine item={item} isRead={isRead} />
          <h2
            className={`mt-1.5 font-semibold leading-snug tracking-[-0.005em] ${
              isRead ? "text-river-muted" : "text-river-text"
            } ${featured ? "text-[1.25rem]" : "text-[1rem]"}`}
          >
            {item.title}
          </h2>
          {item.preview && (
            <p className="mt-1 line-clamp-2 text-[0.875rem] leading-relaxed text-river-muted">
              {item.preview}
            </p>
          )}
          {(item.author || engBits.length > 0) && (
            <div className="mt-2 flex items-center gap-2 text-[0.75rem] tabular-nums text-river-muted/90">
              {item.author && <span className="truncate">{item.author}</span>}
              {item.author && engBits.length > 0 && <span aria-hidden>·</span>}
              {engBits.length > 0 && <span className="shrink-0">{engBits.join("　")}</span>}
            </div>
          )}
        </div>
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="mt-1 h-[4.5rem] w-[4.5rem] shrink-0 rounded-lg bg-river-raised object-cover sm:h-20 sm:w-28"
          />
        )}
      </Link>

      {groupSize >= 2 && (
        <div className="pb-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setOpen((v) => !v);
            }}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 -ml-1.5 text-[0.75rem] font-medium text-river-accent transition-colors hover:bg-river-accent/10"
          >
            合流 ×{groupSize}
            <span className="text-[0.625rem] opacity-70">{open ? "▲" : "▼"}</span>
          </button>
          {open && others.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 border-l border-river-border pl-3">
              {others.map((sib) => (
                <li key={sib.id}>
                  <Link
                    href={detailHref(sib)}
                    prefetch
                    onClick={() => {
                      stashPendingPost(sib);
                      onOpen?.(sib.id);
                    }}
                    onMouseEnter={() => prefetchPostApi(sib)}
                    className="flex items-start gap-2 rounded-md px-2 py-1.5 text-[0.8125rem] transition-colors hover:bg-river-text/[0.035]"
                  >
                    <SourceBadge source={sib.source} />
                    <span className="min-w-0 flex-1 leading-snug text-river-muted line-clamp-2">
                      {sib.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Compact image-first card for 圖牆 mode. */
export function ImageWallCard({
  item,
  isRead,
  onOpen,
  index = 0,
}: {
  item: FeedItem;
  isRead?: boolean;
  onOpen?: (id: string) => void;
  index?: number;
}) {
  const thumb = item.images?.[0];
  if (!thumb) return null;
  const delay = Math.min(index, 10) * 20;

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
      className={`fade-rise group block ${isRead ? "opacity-[0.55]" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="overflow-hidden rounded-lg bg-river-raised">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="aspect-[4/5] w-full object-cover transition-opacity group-hover:opacity-90"
        />
      </div>
      <div className="mt-2 px-0.5">
        <div className="flex items-center gap-1.5 text-[0.6875rem] text-river-muted">
          <SourceBadge source={item.source} />
          {isRead && <span>已讀</span>}
        </div>
        <h2 className="mt-1 line-clamp-2 text-[0.8125rem] font-medium leading-snug text-river-text group-hover:underline group-hover:underline-offset-2">
          {item.title}
        </h2>
      </div>
    </Link>
  );
}
