"use client";

import { useState } from "react";
import Link from "next/link";
import type { FeedItem } from "@/lib/sources/types";
import type { ConfluenceGroup } from "@/lib/confluence";
import { detailHref } from "@/lib/confluence";
import { formatTime } from "@/lib/format";
import { SourceBadge } from "./SourceBadge";

export function FeedCard({
  item,
  confluence,
  siblings,
  isRead,
  onOpen,
}: {
  item: FeedItem;
  confluence?: ConfluenceGroup | null;
  siblings?: FeedItem[];
  isRead?: boolean;
  onOpen?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const eng = item.engagement;
  const engBits: string[] = [];
  if (eng?.pushes) engBits.push(`推 ${eng.pushes}`);
  if (eng?.boos) engBits.push(`噓 ${eng.boos}`);
  if (eng?.likes) engBits.push(`♥ ${eng.likes}`);
  if (eng?.comments && !eng.pushes) engBits.push(`留言 ${eng.comments}`);

  const thumb = item.images?.[0];
  const groupSize = confluence?.memberIds.length ?? 0;
  const others =
    siblings?.filter((s) => s.id !== item.id) ||
    [];

  return (
    <div
      className={`rounded-lg border border-river-border bg-river-panel/80 transition hover:border-river-accent/40 hover:bg-river-panel ${
        isRead ? "opacity-[0.55]" : ""
      }`}
    >
      <Link
        href={detailHref(item)}
        onClick={() => onOpen?.(item.id)}
        className="block p-3.5"
      >
        <div className="mb-2 flex items-center gap-2 text-xs text-river-muted">
          <SourceBadge source={item.source} />
          <span className="truncate">{item.channel}</span>
          {isRead && (
            <span className="shrink-0 rounded border border-river-border/80 px-1 py-px text-[9px] text-river-muted">
              已讀
            </span>
          )}
          <span className="ml-auto shrink-0 tabular-nums">
            {formatTime(item.createdAt)}
          </span>
        </div>
        <div className={thumb ? "flex gap-3" : undefined}>
          <div className="min-w-0 flex-1">
            <h2 className="mb-1.5 text-[15px] font-semibold leading-snug text-river-text">
              {item.title}
            </h2>
            <p className="line-clamp-2 text-sm leading-relaxed text-river-muted">
              {item.preview}
            </p>
          </div>
          {thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-16 w-16 shrink-0 rounded-md border border-river-border object-cover"
            />
          )}
        </div>
        <div className="mt-2.5 flex items-center gap-3 text-[11px] text-river-muted">
          <span>{item.author}</span>
          {engBits.length > 0 && (
            <span className="ml-auto tabular-nums">{engBits.join(" · ")}</span>
          )}
        </div>
      </Link>

      {groupSize >= 2 && (
        <div className="border-t border-river-border/60 px-3.5 py-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setOpen((v) => !v);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-river-threads/40 bg-river-threads/10 px-2 py-0.5 text-[10px] font-medium text-river-threads transition hover:bg-river-threads/20"
          >
            合流 ×{groupSize}
            <span className="opacity-70">{open ? "▴" : "▾"}</span>
          </button>
          {open && others.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {others.map((sib) => (
                <li key={sib.id}>
                  <Link
                    href={detailHref(sib)}
                    onClick={() => onOpen?.(sib.id)}
                    className="flex items-start gap-2 rounded-md border border-river-border/50 bg-river-bg/40 px-2 py-1.5 text-[11px] hover:border-river-accent/30"
                  >
                    <SourceBadge source={sib.source} />
                    <span className="min-w-0 flex-1 leading-snug text-river-muted line-clamp-2 hover:text-river-text">
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
}: {
  item: FeedItem;
  isRead?: boolean;
  onOpen?: (id: string) => void;
}) {
  const thumb = item.images?.[0];
  if (!thumb) return null;

  return (
    <Link
      href={detailHref(item)}
      onClick={() => onOpen?.(item.id)}
      className={`group relative block overflow-hidden rounded-lg border border-river-border bg-river-panel transition hover:border-river-accent/50 ${
        isRead ? "opacity-[0.55]" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumb}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className="aspect-[4/5] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-2.5 pt-8">
        <div className="mb-1 flex items-center gap-1.5">
          <SourceBadge source={item.source} />
          {isRead && (
            <span className="rounded border border-white/20 px-1 py-px text-[9px] text-white/70">
              已讀
            </span>
          )}
        </div>
        <h2 className="line-clamp-2 text-[12px] font-semibold leading-snug text-white">
          {item.title}
        </h2>
      </div>
    </Link>
  );
}
