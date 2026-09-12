import { withTimeout } from "../cache";
import { interleaveByRecency } from "../shuffle";
import type { FeedItem, Post, Source, SourceId } from "./types";
import { pttSource } from "./ptt";
import { threadsSource, threadsLastError } from "./threads";
import { newsSource, newsLastError } from "./news";

/** Don't let one slow source (e.g. Threads) hold the whole river. */
const SOURCE_TIMEOUT_MS = 4_000;

/** Active sources merged into the default river. */
export const sources: Source[] = [
  pttSource,
  threadsSource,
  newsSource,
];

export const sourceMap: Partial<Record<SourceId, Source>> = {
  ptt: pttSource,
  threads: threadsSource,
  news: newsSource,
};

export type { FeedItem, Post, Source, SourceId };

export type RiverError = { source: SourceId; message: string };

export type RiverResult = {
  items: FeedItem[];
  errors: RiverError[];
};

function byCreatedAtDesc(a: FeedItem, b: FeedItem): number {
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  const ma = Number.isFinite(ta) ? ta : -Infinity;
  const mb = Number.isFinite(tb) ? tb : -Infinity;
  return mb - ma;
}

/**
 * Merge active sources into a newest-first river with source interleave.
 * Over-fetches per source; sorts each batch by recency, weaves PTT /
 * Threads / news, then dedupes — no final shuffle.
 */
export async function fetchRiver(options?: {
  source?: SourceId | "all";
  limit?: number;
}): Promise<RiverResult> {
  const limit = options?.limit ?? 60;
  const filter =
    options?.source && options.source !== "all" ? options.source : null;

  const selected = filter
    ? ([sourceMap[filter]].filter(Boolean) as Source[])
    : sources;

  // Over-fetch 2–3× so sampling has room to vary
  const perSourcePool = Math.max(
    12,
    Math.ceil((limit * 2.5) / Math.max(selected.length, 1))
  );

  const batches = await Promise.all(
    selected.map(async (s) => {
      try {
        return await withTimeout(
          s.fetchFeed(perSourcePool),
          SOURCE_TIMEOUT_MS,
          () => {
            console.warn(
              `[river] source ${s.id} timed out after ${SOURCE_TIMEOUT_MS}ms`
            );
            return [] as FeedItem[];
          }
        );
      } catch (err) {
        console.error(`[river] source ${s.id} failed:`, err);
        return [] as FeedItem[];
      }
    })
  );

  const errors: RiverError[] = [];
  if (threadsLastError) {
    errors.push({ source: "threads", message: threadsLastError });
  }
  if (newsLastError) {
    errors.push({ source: "news", message: newsLastError });
  }

  // Sort each source batch newest-first
  const sorted = batches
    .map((batch) => [...batch].sort(byCreatedAtDesc))
    .filter((b) => b.length > 0);

  // Single-source filter: keep chronological desc (no multi-source weave needed)
  let items =
    sorted.length <= 1
      ? (sorted[0] ?? [])
      : interleaveByRecency(sorted);

  // Dedupe by id (same post could appear twice across caches)
  const seen = new Set<string>();
  items = items.filter((it) => {
    if (seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });

  items = items.slice(0, limit);

  return { items, errors };
}

export async function fetchPostDetail(
  source: SourceId,
  params: Record<string, string>
): Promise<Post | null> {
  const s = sourceMap[source];
  if (!s?.fetchPost) return null;
  try {
    return await s.fetchPost(params);
  } catch (err) {
    console.error(`[river] post ${source} failed:`, err);
    return null;
  }
}
