import Link from "next/link";
import type { FeedItem } from "@/lib/sources/types";
import { formatTime } from "@/lib/format";
import { SourceBadge } from "./SourceBadge";

function detailHref(item: FeedItem): string {
  const p = item.detailParams || { source: item.source, id: item.id };
  const q = new URLSearchParams(p);
  return `/post?${q.toString()}`;
}

export function FeedCard({ item }: { item: FeedItem }) {
  const eng = item.engagement;
  const engBits: string[] = [];
  if (eng?.pushes) engBits.push(`推 ${eng.pushes}`);
  if (eng?.boos) engBits.push(`噓 ${eng.boos}`);
  if (eng?.likes) engBits.push(`♥ ${eng.likes}`);
  if (eng?.comments && !eng.pushes) engBits.push(`留言 ${eng.comments}`);

  const thumb = item.images?.[0];

  return (
    <Link
      href={detailHref(item)}
      className="block rounded-lg border border-river-border bg-river-panel/80 p-3.5 transition hover:border-river-accent/40 hover:bg-river-panel"
    >
      <div className="mb-2 flex items-center gap-2 text-xs text-river-muted">
        <SourceBadge source={item.source} />
        <span className="truncate">{item.channel}</span>
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
  );
}
