import type { FeedItem } from "@/lib/sources/types";

const PREFIX = "nc:pending:";

const prefetched = new Set<string>();

export function pendingStorageKey(id: string): string {
  return PREFIX + id;
}

export function stashPendingPost(item: FeedItem): void {
  if (typeof window === "undefined") return;
  try {
    const json = JSON.stringify(item);
    sessionStorage.setItem(pendingStorageKey(item.id), json);
    const dpId = item.detailParams?.id;
    if (dpId && dpId !== item.id) {
      sessionStorage.setItem(pendingStorageKey(dpId), json);
    }
  } catch {
    /* quota / private mode */
  }
}

export function readPendingPost(...ids: Array<string | undefined | null>): FeedItem | null {
  if (typeof window === "undefined") return null;
  for (const id of ids) {
    if (!id) continue;
    try {
      const raw = sessionStorage.getItem(pendingStorageKey(id));
      if (raw) return JSON.parse(raw) as FeedItem;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Identity + shell metadata query for /api/post (stable enough to cache). */
export function postApiQuery(item: FeedItem): URLSearchParams {
  const p = { ...(item.detailParams || { source: item.source, id: item.id }) };
  if (!p.source) p.source = item.source;
  if (item.title && !p.title) p.title = item.title;
  if (item.author && !p.author) p.author = item.author;
  if (item.channel && !p.channel) p.channel = item.channel;
  if (item.createdAt && !p.createdAt) p.createdAt = item.createdAt;
  if (item.preview && !p.preview) p.preview = item.preview.slice(0, 180);
  return new URLSearchParams(p);
}

export function postApiHref(item: FeedItem): string {
  return `/api/post?${postApiQuery(item).toString()}`;
}

export function prefetchPostApi(item: FeedItem): void {
  if (typeof window === "undefined") return;
  const url = postApiHref(item);
  if (prefetched.has(url)) return;
  prefetched.add(url);
  void fetch(url).catch(() => {
    prefetched.delete(url);
  });
}

export function candidatePendingIds(params: Record<string, string>): string[] {
  const source = (params.source || "").toLowerCase();
  const id = params.id || "";
  const board = params.board || "";
  const out: string[] = [];
  if (source === "news" && id) out.push(`news:${id}`);
  if (source === "threads" && id) out.push(`threads:${id}`);
  if (source === "ptt" && board && id) out.push(`ptt:${board}:${id}`);
  if (id) out.push(id);
  return out;
}
