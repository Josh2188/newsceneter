import { withTimeout } from "../cache";
import { createRng, interleaveByRecency } from "../shuffle";
import type { FeedItem, Post, Source, SourceId } from "./types";
import { pttSource } from "./ptt";
import { threadsSource, threadsLastError } from "./threads";
import { newsSource, newsLastError } from "./news";

/** Don't let one slow source (e.g. Threads) hold the whole river. */
const SOURCE_TIMEOUT_MS = 4_000;

/** Target interleaved pool size for pagination (aim 150–300). */
const POOL_TARGET = 240;

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
  /** Full interleaved pool size before slicing. */
  total: number;
  hasMore: boolean;
  nextOffset: number;
  /** Echo / generated seed so page N+1 continues the same order. */
  seed: string;
};

function byCreatedAtDesc(a: FeedItem, b: FeedItem): number {
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  const ma = Number.isFinite(ta) ? ta : -Infinity;
  const mb = Number.isFinite(tb) ? tb : -Infinity;
  return mb - ma;
}

export function makeRiverSeed(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/**
 * Merge active sources into a newest-first river with source interleave.
 * Builds a large interleaved pool (under source timeouts), then slices by
 * offset/limit. Same seed → same pool order so pagination stays stable.
 * Order is recency + interleave; seed only stabilizes any remaining
 * randomness in per-source pool construction.
 */
export async function fetchRiver(options?: {
  source?: SourceId | "all";
  limit?: number;
  offset?: number;
  seed?: string | number;
  /** Override internal pool target (default ~240). */
  poolSize?: number;
}): Promise<RiverResult> {
  const limit = Math.max(1, options?.limit ?? 40);
  const offset = Math.max(0, options?.offset ?? 0);
  const seed = options?.seed != null && String(options.seed) !== ""
    ? String(options.seed)
    : makeRiverSeed();
  const filter =
    options?.source && options.source !== "all" ? options.source : null;

  const selected = filter
    ? ([sourceMap[filter]].filter(Boolean) as Source[])
    : sources;

  const poolTarget = Math.max(
    options?.poolSize ?? POOL_TARGET,
    offset + limit,
    60
  );

  // Over-fetch per source so interleave has a deep pool
  const perSourcePool = Math.max(
    40,
    Math.ceil((poolTarget * 1.2) / Math.max(selected.length, 1))
  );

  // Touch rng so seed is validated; sources get the same string seed
  createRng(seed);

  const batches = await Promise.all(
    selected.map(async (s) => {
      try {
        return await withTimeout(
          s.fetchFeed(perSourcePool, { seed }),
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
  let pool =
    sorted.length <= 1
      ? (sorted[0] ?? [])
      : interleaveByRecency(sorted);

  // Dedupe by id (same post could appear twice across caches)
  const seen = new Set<string>();
  pool = pool.filter((it) => {
    if (seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });

  const total = pool.length;
  const items = pool.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  const hasMore = nextOffset < total;

  return { items, errors, total, hasMore, nextOffset, seed };
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
