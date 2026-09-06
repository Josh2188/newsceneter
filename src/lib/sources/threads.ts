import { getCached, setCache } from "../cache";
import type { FeedItem, Post, Source } from "./types";

const CACHE_TTL = 60_000;
const DEFAULT_USERS = ["zuck", "meta", "threads"];

const UA_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const UA_GOOGLEBOT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

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

type RawPost = {
  code: string;
  username: string;
  text: string;
  likeCount?: number;
  commentCount?: number;
  takenAt?: number;
};

function parseMediaData(html: string, fallbackUser: string): RawPost[] {
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

    // Skip pure replies if flagged (still keep if it's the thread root)
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
function parseFallback(html: string, fallbackUser: string): RawPost[] {
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

function toFeedItem(raw: RawPost): FeedItem {
  const createdAt = raw.takenAt
    ? new Date(raw.takenAt * 1000).toISOString()
    : new Date().toISOString();
  const url = `https://www.threads.net/@${raw.username}/post/${raw.code}`;
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

async function fetchProfileHtml(username: string): Promise<string> {
  const url = `https://www.threads.net/@${encodeURIComponent(username)}`;
  const attempts = [UA_GOOGLEBOT, UA_CHROME];
  let lastStatus = 0;
  for (const ua of attempts) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": ua,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
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

async function fetchUserPosts(username: string): Promise<FeedItem[]> {
  const cacheKey = `threads:user:${username}`;
  const cached = getCached<FeedItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const html = await fetchProfileHtml(username);
    let raw = parseMediaData(html, username);
    if (raw.length === 0) raw = parseFallback(html, username);
    const items = raw.map(toFeedItem);
    // Cache full-text bodies for fetchPost
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
    const items = [...byId.values()]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, limit);

    if (items.length === 0) {
      threadsLastError = "Threads 公開頁面無法取得貼文（可能被封鎖或帳號無效）";
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

    // Re-fetch feed (and thus profiles) then look up
    const feed = await this.fetchFeed(40);
    const item =
      feed.find((x) => x.detailParams?.id === id) ||
      feed.find((x) => x.id === `threads:${id}`);
    if (!item) {
      // Try user-specific re-fetch
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
