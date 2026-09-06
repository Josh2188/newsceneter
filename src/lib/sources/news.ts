import { getCached, setCache } from "../cache";
import type { FeedItem, Post, Source } from "./types";

const CACHE_TTL = 60_000;

/** Public Taiwan-oriented RSS endpoints (best-effort). */
const FEEDS: { channel: string; url: string }[] = [
  {
    channel: "中央社·政治",
    url: "https://feeds.feedburner.com/rsscna/politics",
  },
  {
    channel: "中央社·科技",
    url: "https://feeds.feedburner.com/rsscna/technology",
  },
  {
    channel: "自由時報",
    url: "https://news.ltn.com.tw/rss/all.xml",
  },
  {
    channel: "聯合新聞網",
    url: "https://udn.com/rssfeed/news/2/6638?ch=news",
  },
  {
    channel: "關鍵評論網",
    url: "https://feeds.feedburner.com/TheNewsLens",
  },
];

/** Mutable last-error for river / banner aggregation. */
export let newsLastError: string | null = null;

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  return m ? decodeXml(m[1]) : "";
}

function parseRss(xml: string, channel: string): FeedItem[] {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of blocks.slice(0, 12)) {
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const desc = extractTag(block, "description");
    const pub = extractTag(block, "pubDate");
    const author =
      extractTag(block, "dc:creator") ||
      extractTag(block, "author") ||
      channel;
    if (!title) continue;
    const createdAt = pub ? new Date(pub).toISOString() : new Date().toISOString();
    const idSafe = Buffer.from(`${channel}:${link || title}`)
      .toString("base64url")
      .slice(0, 24);
    items.push({
      id: `news:${idSafe}`,
      source: "news",
      title,
      author,
      channel,
      createdAt: Number.isNaN(Date.parse(createdAt))
        ? new Date().toISOString()
        : createdAt,
      preview: desc.slice(0, 180) || `${channel} 新聞`,
      url: link || "#",
      detailParams: { source: "news", id: idSafe, url: link || "" },
    });
  }
  return items;
}

async function fetchOneFeed(
  channel: string,
  url: string
): Promise<FeedItem[]> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "NewsCeneter/0.1 (RSS reader)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
    const xml = await res.text();
    return parseRss(xml, channel);
  } catch (err) {
    console.error(`[news] feed ${channel} failed:`, err);
    return [];
  }
}

export const newsSource: Source = {
  id: "news",
  label: "新聞",
  async fetchFeed(limit = 20) {
    newsLastError = null;
    const cacheKey = `news:feed:${limit}`;
    const cached = getCached<FeedItem[]>(cacheKey);
    if (cached) return cached;

    const results = await Promise.all(
      FEEDS.map((f) => fetchOneFeed(f.channel, f.url))
    );
    let items = results.flat();
    if (items.length === 0) {
      newsLastError = "所有新聞 RSS 皆無法取得";
      console.error("[news]", newsLastError);
      return [];
    }
    items = items
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, limit);
    return setCache(cacheKey, items, CACHE_TTL);
  },
  async fetchPost(params) {
    const feed = await this.fetchFeed(40);
    const item =
      feed.find((x) => x.detailParams?.id === params.id) ||
      (params.url
        ? feed.find((x) => x.url === params.url)
        : undefined);
    if (!item) return null;
    const post: Post = {
      ...item,
      body: `${item.preview}\n\n原文連結：${item.url}`,
    };
    return post;
  },
};
