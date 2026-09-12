import { withTimeout } from "../cache";
import {
  interleaveRandom,
  sampleN,
  shuffled,
  softRecencyShuffle,
} from "../shuffle";
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

/**
 * Merge active sources into a randomized river.
 * Over-fetches per source, soft-recency shuffles each batch, interleaves
 * across sources, then final shuffle — order differs every request.
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

  // Soft-recency shuffle within each source, then balance via interleave
  const prepared = batches
    .map((batch) => softRecencyShuffle(batch))
    .filter((b) => b.length > 0);

  // Aim for roughly equal representation: take up to ceil(limit/n) from each
  // after soft shuffle, then interleave randomly
  const targetPer = Math.ceil(limit / Math.max(prepared.length, 1));
  const trimmed = prepared.map((b) => b.slice(0, Math.max(targetPer, 8)));

  let items = interleaveRandom(trimmed);

  // Dedupe by id (same post could appear twice across caches)
  const seen = new Set<string>();
  items = items.filter((it) => {
    if (seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });

  // If still short, fill from leftover pool randomly
  if (items.length < limit) {
    const used = new Set(items.map((i) => i.id));
    const leftovers = softRecencyShuffle(
      batches.flat().filter((i) => !used.has(i.id))
    );
    items = [...items, ...leftovers];
  }

  items = shuffled(sampleN(items, limit));

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
