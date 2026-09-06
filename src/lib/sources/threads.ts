import { readFileSync } from "fs";
import { join } from "path";
import { getCached, setCache } from "../cache";
import type { FeedItem, Post, Source } from "./types";
import bundledCacheImport from "../../data/threads-cache.json";

export const CACHE_TTL = 60_000;
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
];

const UA_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const UA_GOOGLEBOT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

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
};

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
      next: { revalidate: 0 },
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

/** Prefer CJK posts; fill with non-CJK only if under limit. */
export function preferCjkItems(items: FeedItem[], limit: number): FeedItem[] {
  const cjk: FeedItem[] = [];
  const other: FeedItem[] = [];
  for (const item of items) {
    if (hasCjk(item)) cjk.push(item);
    else other.push(item);
  }
  if (cjk.length >= limit) return cjk.slice(0, limit);
  return [...cjk, ...other].slice(0, limit);
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

  const sorted = [...bundled.items].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const items = preferCjkItems(sorted, limit);

  console.warn(
    `[threads] 「Threads 即時抓取受限，已顯示快取」 (${items.length} items, updatedAt=${bundled.updatedAt})`
  );
  return items;
}

async function fetchUserPosts(username: string): Promise<FeedItem[]> {
  const cacheKey = `threads:user:${username}`;
  const cached = getCached<FeedItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const { items, raw } = await scrapeUserPosts(username);
    cacheBodies(raw);
    if (items.length === 0) {
      console.warn(`[threads] @${username}: no posts parsed`);
      return [];
    }
    return setCache(cacheKey, items, CACHE_TTL);
  } catch (err) {
    console.error(`[threads] @${username} failed:`, err);
    return [];
  }
}


export const threadsSource: Source = {
  id: "threads",
  label: "Threads",
  async fetchFeed(limit = 20) {
    threadsLastError = null;
    const cacheKey = `threads:feed:${limit}`;
    const cached = getCached<FeedItem[]>(cacheKey);
    if (cached) return cached;

    const users = getUsernames();
    const batches = await Promise.all(users.map((u) => fetchUserPosts(u)));
    const byId = new Map<string, FeedItem>();
    for (const batch of batches) {
      for (const item of batch) {
        if (!byId.has(item.id)) byId.set(item.id, item);
      }
    }
    const sorted = [...byId.values()].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    let items = preferCjkItems(sorted, limit);

    if (items.length === 0) {
      // Live scrape empty (common on Vercel datacenter IPs) → bundled cache
      items = applyBundledCache(limit);
      if (items.length > 0) {
        // Soft notice only in logs; do NOT set threadsLastError (no error banner)
        return setCache(cacheKey, items, CACHE_TTL);
      }
      threadsLastError =
        "Threads 公開頁面無法取得貼文（可能被封鎖或帳號無效），且無可用快取";
      console.error("[threads]", threadsLastError);
      return [];
    }
    return setCache(cacheKey, items, CACHE_TTL);
  },
  async fetchPost(params) {
    const id = params.id;
    if (!id) return null;

    const bodyCached = getCached<{ text: string; item: FeedItem }>(
      `threads:body:${id}`
    );
    if (bodyCached) {
      return {
        ...bodyCached.item,
        body: bodyCached.text,
      } satisfies Post;
    }

    // Try bundled cache bodies before live re-fetch
    const bundled = loadBundledCache();
    if (bundled) {
      const text = bundled.bodies?.[id];
      const item =
        bundled.items.find((x) => x.detailParams?.id === id) ||
        bundled.items.find((x) => x.id === `threads:${id}`);
      if (item && text) {
        return { ...item, body: text } satisfies Post;
      }
      if (item) {
        return { ...item, body: item.preview } satisfies Post;
      }
    }

    // Re-fetch feed (and thus profiles) then look up
    const feed = await this.fetchFeed(40);
    const item =
      feed.find((x) => x.detailParams?.id === id) ||
      feed.find((x) => x.id === `threads:${id}`);
    if (!item) {
      const user = params.user;
      if (user) {
        const userItems = await fetchUserPosts(user);
        const found = userItems.find((x) => x.detailParams?.id === id);
        const body = getCached<{ text: string; item: FeedItem }>(
          `threads:body:${id}`
        );
        if (found && body) {
          return { ...found, body: body.text } satisfies Post;
        }
        if (found) {
          return { ...found, body: found.preview } satisfies Post;
        }
      }
      return null;
    }
    const body = getCached<{ text: string; item: FeedItem }>(
      `threads:body:${id}`
    );
    return {
      ...item,
      body: body?.text || item.preview,
    } satisfies Post;
  },
};
