import { readFileSync } from "fs";
import { join } from "path";
import { durableCached, getCached, setCache, withTimeout } from "../cache";
import { UA_CHROME, UA_GOOGLEBOT } from "../html";
import { dedupeUrls, pickBestCandidate } from "../images";
import { sampleN, shuffled, softRecencyShuffle } from "../shuffle";
import type { Comment, FeedItem, Post, Source } from "./types";
import bundledCacheImport from "../../data/threads-cache.json";

export const CACHE_TTL = 60_000;
const FEED_REVALIDATE = 60;
const POST_REVALIDATE = 180;
const POST_SCRAPE_TIMEOUT_MS = 2500;
/** Default Taiwan / Traditional Chinese accounts (mediaData=true from this env). Override with THREADS_USERS. */
export const DEFAULT_USERS = [
  "thenewslens",
  "dcard.tw",
  "ftvnews",
  "ctinews",
  "taipeitravel",
  "moc_taiwan",
  "gamer_com_tw",
  "dating.pettrainer",
  // Extra TW media / lifestyle (public usernames)
  "pts_tw",
  "tvbsnews",
  "cna_news",
  "stormmedia",
  "bnextmedia",
  "vogue_taiwan",
  "elletaiwan",
  "gqtaiwan",
  "shopping_design",
  "walkerland.tw",
  "foodie.map",
];
const USERS_PER_REFRESH = 5;

export type ThreadsCacheFile = {
  updatedAt: string;
  items: FeedItem[];
  bodies: Record<string, string>;
};

/** Mutable last-error for river / banner aggregation. */
export let threadsLastError: string | null = null;

function getUsernames(): string[] {
  const raw = process.env.THREADS_USERS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim().replace(/^@/, ""))
      .filter(Boolean);
  }
  return DEFAULT_USERS;
}

function extractJsonObject(html: string, startIdx: number): string | null {
  const i = html.indexOf("{", startIdx);
  if (i < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return html.slice(i, j + 1);
    }
  }
  return null;
}

export type RawPost = {
  code: string;
  username: string;
  text: string;
  likeCount?: number;
  commentCount?: number;
  takenAt?: number;
  images?: string[];
};


/** Pull image URLs from a Threads/IG-style post node. */
export function extractImagesFromThreadsPost(
  post: Record<string, unknown> | null | undefined
): string[] {
  if (!post) return [];
  const urls: string[] = [];

  const pushFromIv2 = (node: Record<string, unknown> | null | undefined) => {
    if (!node) return;
    const iv2 = node.image_versions2 as
      | { candidates?: Array<{ url?: string; width?: number; height?: number }> }
      | null
      | undefined;
    const best = pickBestCandidate(iv2?.candidates || []);
    if (best) urls.push(best);
  };

  // Single image
  pushFromIv2(post);

  // Carousel
  const carousel = post.carousel_media as
    | Array<Record<string, unknown>>
    | null
    | undefined;
  if (Array.isArray(carousel)) {
    for (const slide of carousel) {
      pushFromIv2(slide);
    }
  }

  // Sometimes nested under text_post_app_info / media
  const media = post.media as Record<string, unknown> | null | undefined;
  if (media) pushFromIv2(media);

  return dedupeUrls(urls);
}

export function parseMediaData(html: string, fallbackUser: string): RawPost[] {
  const marker = '"mediaData":';
  const start = html.indexOf(marker);
  if (start < 0) return [];
  const objStr = extractJsonObject(html, start + marker.length - 1);
  if (!objStr) return [];

  let data: { edges?: Array<{ node?: { thread_items?: unknown[] } }> };
  try {
    data = JSON.parse(objStr);
  } catch {
    return [];
  }

  const out: RawPost[] = [];
  const seen = new Set<string>();

  for (const edge of data.edges || []) {
    const items = (edge.node?.thread_items || []) as Array<{
      post?: Record<string, unknown>;
    }>;
    // Prefer root post of each thread (first item)
    const post = items[0]?.post;
    if (!post) continue;
    const code = typeof post.code === "string" ? post.code : "";
    if (!code || seen.has(code)) continue;

    const caption = post.caption as { text?: string } | null | undefined;
    const text = (caption?.text || "").trim();
    if (!text) continue;

    const userObj = post.user as { username?: string } | null | undefined;
    const username = userObj?.username || fallbackUser;
    const tpa = post.text_post_app_info as
      | { direct_reply_count?: number; is_reply?: boolean }
      | null
      | undefined;

    seen.add(code);
    const images = extractImagesFromThreadsPost(post);
    out.push({
      code,
      username,
      text,
      likeCount:
        typeof post.like_count === "number" ? post.like_count : undefined,
      commentCount:
        typeof tpa?.direct_reply_count === "number"
          ? tpa.direct_reply_count
          : undefined,
      takenAt: typeof post.taken_at === "number" ? post.taken_at : undefined,
      images: images.length ? images : undefined,
    });
  }
  return out;
}

/** Fallback regex scrape when mediaData JSON parse fails. */
export function parseFallback(html: string, fallbackUser: string): RawPost[] {
  const out: RawPost[] = [];
  const seen = new Set<string>();
  const re =
    /"code"\s*:\s*"([A-Za-z0-9_-]{8,})"[\s\S]{0,1200}?"caption"\s*:\s*\{\s*"text"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const code = m[1];
    if (seen.has(code) || code === "en_US") continue;
    let text = "";
    try {
      text = JSON.parse(`"${m[2]}"`);
    } catch {
      text = m[2];
    }
    text = text.trim();
    if (!text) continue;
    const winStart = Math.max(0, m.index - 200);
    const win = html.slice(winStart, m.index + 2000);
    const like = win.match(/"like_count"\s*:\s*(\d+)/);
    const taken = win.match(/"taken_at"\s*:\s*(\d+)/);
    const user = win.match(/"username"\s*:\s*"([^"]+)"/);
    seen.add(code);
    out.push({
      code,
      username: user?.[1] || fallbackUser,
      text,
      likeCount: like ? Number(like[1]) : undefined,
      takenAt: taken ? Number(taken[1]) : undefined,
    });
  }
  return out;
}


/** Parse reply/root posts from a Threads post-detail HTML blob. */
export function parsePostPageData(
  html: string,
  rootCode: string,
  fallbackUser: string
): { rootText: string; comments: Comment[]; root?: RawPost; images: string[] } {
  const comments: Comment[] = [];
  let rootText = "";
  let root: RawPost | undefined;

  const tryParseEdges = (edges: Array<{ node?: { thread_items?: unknown[] } }>) => {
    const posts: Array<{
      code: string;
      username: string;
      text: string;
      likeCount?: number;
      commentCount?: number;
      takenAt?: number;
      isReply?: boolean;
      images?: string[];
    }> = [];
    const seen = new Set<string>();
    for (const edge of edges || []) {
      const items = (edge.node?.thread_items || []) as Array<{
        post?: Record<string, unknown>;
      }>;
      for (const item of items) {
        const post = item?.post;
        if (!post) continue;
        const code = typeof post.code === "string" ? post.code : "";
        if (!code || seen.has(code)) continue;
        const caption = post.caption as { text?: string } | null | undefined;
        const text = (caption?.text || "").trim();
        // Allow image-only posts (empty caption) when images exist
        const images = extractImagesFromThreadsPost(post);
        if (!text && images.length === 0) continue;
        const userObj = post.user as { username?: string } | null | undefined;
        const username = userObj?.username || fallbackUser;
        const tpa = post.text_post_app_info as
          | { direct_reply_count?: number; is_reply?: boolean }
          | null
          | undefined;
        seen.add(code);
        posts.push({
          code,
          username,
          text,
          likeCount:
            typeof post.like_count === "number" ? post.like_count : undefined,
          commentCount:
            typeof tpa?.direct_reply_count === "number"
              ? tpa.direct_reply_count
              : undefined,
          takenAt: typeof post.taken_at === "number" ? post.taken_at : undefined,
          isReply: Boolean(tpa?.is_reply) || code !== rootCode,
          images: images.length ? images : undefined,
        });
      }
    }
    return posts;
  };

  // Profile-style mediaData
  const mediaMarker = '"mediaData":';
  const mediaStart = html.indexOf(mediaMarker);
  if (mediaStart >= 0) {
    const objStr = extractJsonObject(html, mediaStart + mediaMarker.length - 1);
    if (objStr) {
      try {
        const data = JSON.parse(objStr) as {
          edges?: Array<{ node?: { thread_items?: unknown[] } }>;
        };
        const posts = tryParseEdges(data.edges || []);
        for (const p of posts) {
          if (p.code === rootCode || (!root && !p.isReply)) {
            rootText = p.text;
            root = {
              code: p.code,
              username: p.username,
              text: p.text,
              likeCount: p.likeCount,
              commentCount: p.commentCount,
              takenAt: p.takenAt,
              images: p.images,
            };
          } else if (p.text) {
            comments.push({
              id: `threads-reply-${p.code}`,
              author: p.username,
              body: p.text,
              type: "comment",
            });
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  // Post-page embedded payload: "data":{"data":{"edges":[...
  if (!rootText || comments.length === 0) {
    const dataMarker = '"data":{"data":';
    let searchFrom = 0;
    while (searchFrom < html.length) {
      const idx = html.indexOf(dataMarker, searchFrom);
      if (idx < 0) break;
      const objStr = extractJsonObject(html, idx + '"data":'.length);
      searchFrom = idx + dataMarker.length;
      if (!objStr || objStr.length < 100) continue;
      if (!objStr.includes("thread_items") && !objStr.includes('"caption"')) {
        continue;
      }
      try {
        const parsed = JSON.parse(objStr) as {
          data?: { edges?: Array<{ node?: { thread_items?: unknown[] } }> };
          edges?: Array<{ node?: { thread_items?: unknown[] } }>;
        };
        const edges = parsed.data?.edges || parsed.edges || [];
        if (!edges.length) continue;
        const posts = tryParseEdges(edges);
        if (!posts.length) continue;
        for (const p of posts) {
          if (p.code === rootCode || (!root && !p.isReply)) {
            if (p.text.length > rootText.length || (!rootText && p.images?.length)) {
              rootText = p.text || rootText;
              root = {
                code: p.code,
                username: p.username,
                text: p.text || rootText,
                likeCount: p.likeCount,
                commentCount: p.commentCount,
                takenAt: p.takenAt,
                images: p.images?.length ? p.images : root?.images,
              };
            } else if (p.images?.length && !root?.images?.length) {
              if (root) root.images = p.images;
              else {
                root = {
                  code: p.code,
                  username: p.username,
                  text: p.text,
                  likeCount: p.likeCount,
                  commentCount: p.commentCount,
                  takenAt: p.takenAt,
                  images: p.images,
                };
              }
            }
          } else if (
            p.text &&
            !comments.some((c) => c.id === `threads-reply-${p.code}`)
          ) {
            comments.push({
              id: `threads-reply-${p.code}`,
              author: p.username,
              body: p.text,
              type: "comment",
            });
          }
        }
        if (rootText) break;
      } catch {
        /* try next */
      }
    }
  }

  // Regex fallback for captions on post page
  if (!rootText) {
    const fallback = parseFallback(html, fallbackUser);
    const match =
      fallback.find((p) => p.code === rootCode) || fallback[0];
    if (match) {
      rootText = match.text;
      root = match;
    }
  }

  const images = dedupeUrls(root?.images || []);
  return { rootText, comments, root, images };
}

export async function fetchPostHtml(
  username: string,
  code: string
): Promise<string> {
  const url = `https://www.threads.com/@${encodeURIComponent(username)}/post/${encodeURIComponent(code)}`;
  const attempts = [UA_GOOGLEBOT, UA_CHROME];
  let lastStatus = 0;
  for (const ua of attempts) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": ua,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: "https://www.threads.com/",
      },
      redirect: "follow",
      next: { revalidate: POST_REVALIDATE },
    });
    lastStatus = res.status;
    if (!res.ok) continue;
    const html = await res.text();
    if (
      html.includes("thread_items") ||
      html.includes("mediaData") ||
      html.includes('"caption"')
    ) {
      return html;
    }
  }
  throw new Error(
    `Threads post HTTP ${lastStatus} or empty for @${username}/post/${code}`
  );
}

export function toFeedItem(raw: RawPost): FeedItem {
  const createdAt = raw.takenAt
    ? new Date(raw.takenAt * 1000).toISOString()
    : new Date().toISOString();
  const url = `https://www.threads.com/@${raw.username}/post/${raw.code}`;
  const preview = raw.text.replace(/\s+/g, " ").slice(0, 180);
  const title =
    raw.text.split("\n").find((l) => l.trim())?.trim().slice(0, 80) ||
    `@${raw.username} 貼文`;
  return {
    id: `threads:${raw.code}`,
    source: "threads",
    title,
    author: raw.username,
    channel: `@${raw.username}`,
    createdAt: Number.isNaN(Date.parse(createdAt))
      ? new Date().toISOString()
      : createdAt,
    preview,
    url,
    images: raw.images?.length ? raw.images : undefined,
    engagement: {
      likes: raw.likeCount,
      comments: raw.commentCount,
    },
    detailParams: {
      source: "threads",
      id: raw.code,
      user: raw.username,
    },
  };
}

export async function fetchProfileHtml(username: string): Promise<string> {
  const url = `https://www.threads.com/@${encodeURIComponent(username)}`;
  const attempts = [UA_GOOGLEBOT, UA_CHROME];
  let lastStatus = 0;
  for (const ua of attempts) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": ua,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,zh-TW;q=0.8",
        Referer: "https://www.threads.com/",
      },
      redirect: "follow",
      next: { revalidate: FEED_REVALIDATE },
    });
    lastStatus = res.status;
    if (!res.ok) continue;
    const html = await res.text();
    if (html.includes("mediaData") || html.includes('"caption"')) {
      return html;
    }
  }
  throw new Error(`Threads HTTP ${lastStatus} or empty profile for @${username}`);
}

function cacheBodies(raw: RawPost[]) {
  for (const r of raw) {
    setCache(
      `threads:body:${r.code}`,
      { text: r.text, item: toFeedItem(r) } as {
        text: string;
        item: FeedItem;
      },
      CACHE_TTL * 2
    );
  }
}

/** Scrape one profile and return feed items + raw posts (for cache refresh). */
export async function scrapeUserPosts(
  username: string
): Promise<{ items: FeedItem[]; raw: RawPost[] }> {
  const html = await fetchProfileHtml(username);
  let raw = parseMediaData(html, username);
  if (raw.length === 0) raw = parseFallback(html, username);
  return { items: raw.map(toFeedItem), raw };
}

function loadBundledCache(): ThreadsCacheFile | null {
  // 1) Static import — works on Vercel after build embeds the JSON
  try {
    if (bundledCacheImport?.items?.length) {
      return bundledCacheImport as ThreadsCacheFile;
    }
  } catch {
    /* ignore */
  }
  // 2) fs read — useful in Node/scripts and when JSON was refreshed at runtime
  try {
    const candidates = [
      join(process.cwd(), "src/data/threads-cache.json"),
      join(process.cwd(), "data/threads.json"),
    ];
    for (const p of candidates) {
      try {
        const text = readFileSync(p, "utf8");
        const data = JSON.parse(text) as ThreadsCacheFile;
        if (data?.items?.length) return data;
      } catch {
        /* try next */
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}


const CJK_RE = /[\u4e00-\u9fff]/;

export function hasCjk(item: FeedItem): boolean {
  const hay = `${item.title || ""} ${item.preview || ""}`;
  return CJK_RE.test(hay);
}

/**
 * Soft-prefer CJK: shuffle heavily among CJK pool first, fill with non-CJK
 * only if under limit. Does NOT return chronological head.
 */
export function preferCjkItems(items: FeedItem[], limit: number): FeedItem[] {
  const cjk: FeedItem[] = [];
  const other: FeedItem[] = [];
  for (const item of items) {
    if (hasCjk(item)) cjk.push(item);
    else other.push(item);
  }
  const cjkShuffled = softRecencyShuffle(cjk);
  if (cjkShuffled.length >= limit) {
    return sampleN(cjkShuffled, limit);
  }
  const need = limit - cjkShuffled.length;
  return shuffled([...cjkShuffled, ...sampleN(other, need)]);
}

function applyBundledCache(limit: number): FeedItem[] {
  const bundled = loadBundledCache();
  if (!bundled?.items?.length) return [];

  for (const [code, text] of Object.entries(bundled.bodies || {})) {
    const item = bundled.items.find((i) => i.detailParams?.id === code);
    if (item) {
      setCache(
        `threads:body:${code}`,
        { text, item },
        CACHE_TTL * 2
      );
    }
  }

  const items = preferCjkItems(softRecencyShuffle(bundled.items), limit);

  console.warn(
    `[threads] 「Threads 即時抓取受限，已顯示快取」 (${items.length} items, updatedAt=${bundled.updatedAt})`
  );
  return items;
}

async function fetchUserPosts(username: string): Promise<FeedItem[]> {
  return durableCached(
    ["threads", "user", username],
    async () => {
      try {
        const { items, raw } = await scrapeUserPosts(username);
        cacheBodies(raw);
        if (items.length === 0) {
          console.warn(`[threads] @${username}: no posts parsed`);
          return [];
        }
        return items;
      } catch (err) {
        console.error(`[threads] @${username} failed:`, err);
        return [];
      }
    },
    {
      revalidate: FEED_REVALIDATE,
      failRevalidate: 15,
      isFailure: (items) => items.length === 0,
    }
  );
}


function itemFromParams(params: Record<string, string>): FeedItem {
  const id = params.id;
  const user = (params.user || "").replace(/^@/, "");
  const url = user
    ? `https://www.threads.com/@${user}/post/${id}`
    : `https://www.threads.com/t/${id}`;
  return {
    id: `threads:${id}`,
    source: "threads",
    title: params.title || (user ? `@${user} 貼文` : "Threads 貼文"),
    author: params.author || user || "threads",
    channel: params.channel || (user ? `@${user}` : "Threads"),
    createdAt: params.createdAt || new Date().toISOString(),
    preview: params.preview || "",
    url,
    detailParams: { source: "threads", id, user },
  };
}

async function fetchThreadsPostUncached(
  params: Record<string, string>
): Promise<Post | null> {
  const id = params.id;
  if (!id) return null;

  const user = (params.user || "").replace(/^@/, "");
  let baseItem: FeedItem | null = null;
  let bodyText = "";
  let comments: Comment[] = [];
  let scrapeNote: string | null = null;
  let images: string[] = [];

  // Memory / bundled body cache first (fast path for caption)
  const bodyCached = getCached<{ text: string; item: FeedItem }>(
    `threads:body:${id}`
  );
  if (bodyCached) {
    baseItem = bodyCached.item;
    bodyText = bodyCached.text;
    if (baseItem.images?.length) images = [...baseItem.images];
  }

  if (!baseItem) {
    const bundled = loadBundledCache();
    if (bundled) {
      const text = bundled.bodies?.[id];
      const item =
        bundled.items.find((x) => x.detailParams?.id === id) ||
        bundled.items.find((x) => x.id === `threads:${id}`);
      if (item) {
        baseItem = item;
        bodyText = text || item.preview;
        if (item.images?.length) images = [...item.images];
      }
    }
  }

  // Query/session metadata — never block on a full river/feed scrape
  if (!baseItem && (user || params.title)) {
    baseItem = itemFromParams(params);
    bodyText = params.preview || "";
  }

  if (!baseItem) return null;

  const username = user || baseItem.author || baseItem.detailParams?.user || "";

  // Live scrape with a short timeout; return cached/preview rather than hang
  if (username) {
    try {
      const html = await withTimeout(
        fetchPostHtml(username, id),
        POST_SCRAPE_TIMEOUT_MS
      );
      const parsed = parsePostPageData(html, id, username);
      if (parsed.rootText && parsed.rootText.length >= bodyText.length) {
        bodyText = parsed.rootText;
        setCache(
          `threads:body:${id}`,
          { text: bodyText, item: baseItem },
          CACHE_TTL * 2
        );
      }
      if (parsed.images.length) {
        images = dedupeUrls([...images, ...parsed.images]);
      }
      comments = parsed.comments;
      if (
        comments.length === 0 &&
        (baseItem.engagement?.comments || 0) > 0
      ) {
        scrapeNote =
          "此貼文頁面未取得公開回應（可能被封鎖或需登入），請至原文查看。";
      }
    } catch (err) {
      console.warn(`[threads] post scrape @${username}/${id} failed:`, err);
      scrapeNote =
        bodyText || baseItem.preview
          ? "Threads 貼文頁面逾時或無法抓取回應，以上為快取／預覽，請至原文查看。"
          : "Threads 貼文頁面無法抓取回應（可能被封鎖），內文來自快取／預覽，請至原文查看。";
      comments = [];
    }
  } else {
    comments = [];
    scrapeNote = "無法解析 Threads 帳號，回應未取得，請至原文查看。";
  }

  let body = bodyText || baseItem.preview;
  if (scrapeNote && comments.length === 0) {
    body = `${body}\n\n※ ${scrapeNote}`;
  }

  if (!images.length && baseItem.images?.length) {
    images = [...baseItem.images];
  }

  return {
    ...baseItem,
    body,
    comments,
    images: images.length ? images : undefined,
  } satisfies Post;
}

export const threadsSource: Source = {
  id: "threads",
  label: "Threads",
  async fetchFeed(limit = 20) {
    threadsLastError = null;
    // Per-user scrapes stay durable-cached; final sample/shuffle runs every request
    // so CDN / Data Cache cannot freeze identical order.
    const allUsers = shuffled(getUsernames());
    const users = allUsers.slice(
      0,
      Math.min(USERS_PER_REFRESH, allUsers.length)
    );
    const batches = await Promise.all(users.map((u) => fetchUserPosts(u)));
    const byId = new Map<string, FeedItem>();
    for (const batch of batches) {
      for (const item of batch) {
        if (!byId.has(item.id)) byId.set(item.id, item);
      }
    }
    let items = preferCjkItems(
      softRecencyShuffle([...byId.values()]),
      Math.max(limit, Math.ceil(limit * 1.5))
    );

    if (items.length === 0) {
      items = applyBundledCache(Math.max(limit, Math.ceil(limit * 1.5)));
      if (items.length === 0) {
        threadsLastError =
          "Threads 公開頁面無法取得貼文（可能被封鎖或帳號無效），且無可用快取";
        console.error("[threads]", threadsLastError);
        return [];
      }
    }
    return sampleN(items, Math.min(limit * 2, items.length));
  },
  async fetchPost(params) {
    const id = params.id;
    if (!id) return null;
    const user = (params.user || "").replace(/^@/, "");
    return durableCached(
      ["threads", "post", user, id],
      () => fetchThreadsPostUncached(params),
      {
        revalidate: POST_REVALIDATE,
        failRevalidate: 20,
        isFailure: (post) => post === null,
      }
    );
  },
};
