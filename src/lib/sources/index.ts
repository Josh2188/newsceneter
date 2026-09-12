import { withTimeout } from "../cache";
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

/** Merge active sources into one chronological river (createdAt desc). */
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

  const batches = await Promise.all(
    selected.map(async (s) => {
      try {
        return await withTimeout(
          s.fetchFeed(Math.ceil(limit / selected.length) + 5),
          SOURCE_TIMEOUT_MS,
          () => {
            console.warn(`[river] source ${s.id} timed out after ${SOURCE_TIMEOUT_MS}ms`);
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

  const items = batches
    .flat()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, limit);

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
