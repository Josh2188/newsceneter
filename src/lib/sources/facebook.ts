import { getCached, setCache } from "../cache";
import type { FeedItem, Post, Source } from "./types";
import {
  fetchRssXml,
  parseRssItems,
  rssHubBase,
} from "./rssParse";

const CACHE_TTL = 60_000;
const GRAPH = "https://graph.facebook.com/v21.0";
const DEFAULT_PAGES = ["CNA.tw", "ltntw", "udn.com"];

/** Mutable last-error for river / banner aggregation. */
export let facebookLastError: string | null = null;

function getMetaToken(): string | null {
  return (
    process.env.META_ACCESS_TOKEN?.trim() ||
    process.env.FACEBOOK_ACCESS_TOKEN?.trim() ||
    null
  );
}

function getPageIds(): string[] {
  const raw = process.env.FACEBOOK_PAGE_IDS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return DEFAULT_PAGES;
}

type GraphPost = {
  id?: string;
  message?: string;
  story?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  shares?: { count?: number };
  comments?: { summary?: { total_count?: number } };
  reactions?: { summary?: { total_count?: number } };
};

function graphPostToItem(pageId: string, p: GraphPost): FeedItem | null {
  const text = (p.message || p.story || "").trim();
  if (!text && !p.permalink_url) return null;
  const id = p.id || `${pageId}:${p.created_time || Math.random()}`;
  const title =
    text.split("\n").find((l) => l.trim())?.trim().slice(0, 80) ||
    `${pageId} 貼文`;
  const createdAt = p.created_time
    ? new Date(p.created_time).toISOString()
    : new Date().toISOString();
  return {
    id: `facebook:${id}`,
    source: "facebook",
    title,
    author: pageId,
    channel: pageId,
    createdAt: Number.isNaN(Date.parse(createdAt))
      ? new Date().toISOString()
      : createdAt,
    preview: text.replace(/\s+/g, " ").slice(0, 180) || title,
    url: p.permalink_url || `https://www.facebook.com/${id}`,
    engagement: {
      likes: p.reactions?.summary?.total_count,
      comments: p.comments?.summary?.total_count,
    },
    detailParams: {
      source: "facebook",
      id,
      page: pageId,
    },
  };
}

async function fetchPageGraph(
  pageId: string,
  token: string,
  limit: number
): Promise<FeedItem[]> {
  const fields = [
    "id",
    "message",
    "story",
    "created_time",
    "permalink_url",
    "full_picture",
    "shares",
    "comments.summary(true)",
    "reactions.summary(true)",
  ].join(",");
  const url =
    `${GRAPH}/${encodeURIComponent(pageId)}/posts` +
    `?fields=${encodeURIComponent(fields)}` +
    `&limit=${Math.min(Math.max(limit, 1), 25)}` +
    `&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  const json = (await res.json()) as {
    data?: GraphPost[];
    error?: { message?: string };
  };
  if (!res.ok || json.error) {
    throw new Error(
      json.error?.message || `Facebook Graph HTTP ${res.status} for ${pageId}`
    );
  }
  const items: FeedItem[] = [];
  for (const p of json.data || []) {
    const item = graphPostToItem(pageId, p);
    if (item) {
      items.push(item);
      setCache(
        `facebook:body:${item.detailParams!.id}`,
        { text: p.message || p.story || item.preview, item },
        CACHE_TTL * 2
      );
    }
  }
  return items;
}

async function fetchPageRssHub(pageId: string): Promise<FeedItem[]> {
  const base = rssHubBase();
  if (!base) return [];
  const xml = await fetchRssXml(
    `${base}/facebook/page/${encodeURIComponent(pageId)}`
  );
  const items: FeedItem[] = [];
  for (const r of parseRssItems(xml, 12)) {
    const title = r.title || `${pageId} 貼文`;
    const idSafe = Buffer.from(`${pageId}:${r.link || title}`)
      .toString("base64url")
      .slice(0, 24);
    const createdAt = r.pub
      ? new Date(r.pub).toISOString()
      : new Date().toISOString();
    const item: FeedItem = {
      id: `facebook:rss:${idSafe}`,
      source: "facebook",
      title,
      author: r.author || pageId,
      channel: pageId,
      createdAt: Number.isNaN(Date.parse(createdAt))
        ? new Date().toISOString()
        : createdAt,
      preview: (r.desc || title).replace(/\s+/g, " ").slice(0, 180),
      url: r.link || "#",
      detailParams: {
        source: "facebook",
        id: idSafe,
        page: pageId,
        url: r.link || "",
      },
    };
    if (item.url === "#") continue;
    items.push(item);
    setCache(
      `facebook:body:${idSafe}`,
      { text: r.desc || title, item },
      CACHE_TTL * 2
    );
  }
  return items;
}

async function fetchPage(pageId: string, limit: number): Promise<FeedItem[]> {
  const cacheKey = `facebook:page:${pageId}`;
  const cached = getCached<FeedItem[]>(cacheKey);
  if (cached) return cached;

  const token = getMetaToken();
  let items: FeedItem[] = [];
  let graphErr: string | null = null;

  if (token) {
    try {
      items = await fetchPageGraph(pageId, token, limit);
    } catch (err) {
      graphErr = err instanceof Error ? err.message : String(err);
      console.error(`[facebook] Graph ${pageId}:`, graphErr);
    }
  }

  if (items.length === 0 && rssHubBase()) {
    try {
      items = await fetchPageRssHub(pageId);
    } catch (err) {
      console.error(`[facebook] RSSHub ${pageId}:`, err);
    }
  }

  if (items.length === 0 && graphErr) {
    // surface latest graph error via module-level later
    console.warn(`[facebook] ${pageId} empty after Graph/RSSHub`);
  }

  if (items.length === 0) return [];
  return setCache(cacheKey, items, CACHE_TTL);
}

export const facebookSource: Source = {
  id: "facebook",
  label: "Facebook",
  async fetchFeed(limit = 20) {
    facebookLastError = null;
    const cacheKey = `facebook:feed:${limit}`;
    const cached = getCached<FeedItem[]>(cacheKey);
    if (cached) return cached;

    const token = getMetaToken();
    const hub = rssHubBase();
    if (!token && !hub) {
      facebookLastError =
        "Facebook 需要 META_ACCESS_TOKEN（或 FACEBOOK_ACCESS_TOKEN）；請於 Graph Explorer 取得 Page token";
      console.error("[facebook]", facebookLastError);
      return [];
    }

    const pages = getPageIds();
    const batches = await Promise.all(
      pages.map((p) => fetchPage(p, Math.ceil(limit / pages.length) + 3))
    );
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
      facebookLastError = token
        ? "Facebook Graph／RSSHub 皆無法取得貼文（請檢查 Page ID 與權限）"
        : "Facebook 無 token，且 RSSHub 後備亦無資料（請設定 META_ACCESS_TOKEN 或 RSSHUB_BASE）";
      console.error("[facebook]", facebookLastError);
      return [];
    }
    return setCache(cacheKey, items, CACHE_TTL);
  },
  async fetchPost(params) {
    const id = params.id;
    if (!id) return null;
    const bodyCached = getCached<{ text: string; item: FeedItem }>(
      `facebook:body:${id}`
    );
    if (bodyCached) {
      return { ...bodyCached.item, body: bodyCached.text } satisfies Post;
    }
    const feed = await this.fetchFeed(40);
    const item =
      feed.find((x) => x.detailParams?.id === id) ||
      feed.find((x) => x.id === `facebook:${id}`) ||
      feed.find((x) => x.id === `facebook:rss:${id}`);
    if (!item) return null;
    const body = getCached<{ text: string; item: FeedItem }>(
      `facebook:body:${id}`
    );
    return {
      ...item,
      body: body?.text || item.preview,
    } satisfies Post;
  },
};
