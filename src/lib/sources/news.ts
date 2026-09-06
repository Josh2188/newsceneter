import * as cheerio from "cheerio";
import { getCached, setCache } from "../cache";
import {
  fetchHtml,
  longestText,
  normalizeParagraphs,
  UA_CHROME,
} from "../html";
import {
  absoluteUrl,
  dedupeUrls,
  isJunkImageUrl,
} from "../images";
import type { FeedItem, Post, Source } from "./types";

const CACHE_TTL = 60_000;
const BODY_CACHE_TTL = 120_000;

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

/** Prefer <link>, then guid when it looks like a URL (UDN sometimes). */
function extractLink(block: string): string {
  const link = extractTag(block, "link");
  if (link && /^https?:\/\//i.test(link)) return link;
  const guidRaw =
    block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] || "";
  const guid = decodeXml(guidRaw);
  if (guid && /^https?:\/\//i.test(guid)) return guid;
  return link || "";
}

function extractDescription(block: string): string {
  const encoded = extractTag(block, "content:encoded");
  const desc = extractTag(block, "description");
  return longestText([encoded, desc]);
}

function parseRss(xml: string, channel: string): FeedItem[] {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of blocks.slice(0, 12)) {
    const title = extractTag(block, "title");
    const link = extractLink(block);
    const desc = extractDescription(block);
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

function joinMeaningful(
  $: cheerio.CheerioAPI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  root: cheerio.Cheerio<any>,
  selector: string,
  skipRe?: RegExp
): string {
  const parts: string[] = [];
  root.find(selector).each((_, el) => {
    const cls = ($(el).attr("class") || "") + " " + ($(el).attr("id") || "");
    if (skipRe && skipRe.test(cls)) return;
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t.length < 15) return;
    if (/^(延伸閱讀|相關新聞|熱門新聞|廣告|推薦)/.test(t)) return;
    parts.push(t);
  });
  return normalizeParagraphs(parts.join("\n\n"));
}

function extractJsonLdArticleBody(html: string): string {
  const $ = cheerio.load(html);
  const bodies: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() || "";
      const parsed = JSON.parse(raw) as unknown;
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const o of arr) {
        if (!o || typeof o !== "object") continue;
        const obj = o as Record<string, unknown>;
        if (typeof obj.articleBody === "string" && obj.articleBody.trim()) {
          bodies.push(normalizeParagraphs(obj.articleBody));
        }
      }
    } catch {
      /* ignore bad ld+json */
    }
  });
  return longestText(bodies);
}


function collectJsonLdImages(value: unknown, out: string[]): void {
  if (!value) return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectJsonLdImages(v, out);
    return;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.url === "string") out.push(obj.url);
    if (typeof obj.contentUrl === "string") out.push(obj.contentUrl);
  }
}

function extractNewsImages(url: string, html: string): string[] {
  const $ = cheerio.load(html);
  const content: string[] = [];
  const meta: string[] = [];

  const push = (bucket: string[], raw: string | undefined | null) => {
    const abs = absoluteUrl(raw || "", url);
    if (!abs || isJunkImageUrl(abs)) return;
    bucket.push(abs);
  };

  // Prefer article content images
  const contentRoots = [
    "[itemprop=articleBody]",
    "article",
    ".paragraph",
    ".article-content__editor",
    ".article-content",
    ".article-body",
    ".post-content",
    ".story-content",
    "#newscontent",
    "#newscotent",
    ".text",
    "main",
  ];
  const seenEls = new Set<unknown>();
  for (const sel of contentRoots) {
    $(sel).each((_, root) => {
      if (seenEls.has(root)) return;
      seenEls.add(root);
      $(root)
        .find("img[src], img[data-src], img[data-original]")
        .each((__, el) => {
          const $el = $(el);
          const cls =
            ($el.attr("class") || "") + " " + ($el.attr("id") || "");
          if (/logo|icon|avatar|ad|share|social|banner/i.test(cls)) return;
          const w = Number($el.attr("width") || 0);
          const h = Number($el.attr("height") || 0);
          if ((w > 0 && w <= 2) || (h > 0 && h <= 2)) return;
          push(
            content,
            $el.attr("src") ||
              $el.attr("data-src") ||
              $el.attr("data-original")
          );
        });
    });
  }

  // og:image / twitter:image as fallback meta
  $('meta[property="og:image"], meta[property="og:image:url"], meta[name="twitter:image"]').each(
    (_, el) => {
      push(meta, $(el).attr("content"));
    }
  );

  // JSON-LD image
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() || "";
      const parsed = JSON.parse(raw) as unknown;
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const o of arr) {
        if (!o || typeof o !== "object") continue;
        const obj = o as Record<string, unknown>;
        const type = String(obj["@type"] || "");
        if (
          /Article|NewsArticle|BlogPosting|WebPage|ImageObject/i.test(type) ||
          obj.image
        ) {
          collectJsonLdImages(obj.image, meta);
        }
      }
    } catch {
      /* ignore */
    }
  });

  // Prefer content; fill with meta if content empty / thin
  const preferred = dedupeUrls(content);
  if (preferred.length >= 1) {
    // Also append non-duplicate meta (e.g. hero not inside body)
    return dedupeUrls([...preferred, ...meta]);
  }
  return dedupeUrls(meta);
}

function scrapeFromHtml(url: string, html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, nav, footer, header").remove();

  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  const candidates: string[] = [];

  // JSON-LD articleBody (CNA, TNL, many others)
  candidates.push(extractJsonLdArticleBody(html));

  // CNA
  if (host.includes("cna.com.tw")) {
    const paras: string[] = [];
    $(".paragraph").each((_, el) => {
      const cls = $(el).attr("class") || "";
      if (/banner|appDownload|ADbox|ad|bottomArticle/i.test(cls)) return;
      const t = $(el).text().replace(/\s+/g, " ").trim();
      if (t.length > 20) paras.push(t);
    });
    candidates.push(normalizeParagraphs(paras.join("\n\n")));
  }

  // The News Lens — prefer JSON-LD; HTML paragraphs as backup
  if (host.includes("thenewslens.com")) {
    const section = $(
      ".js-article-section-wrapper, .article-page-wrapper, article"
    )
      .first()
      .clone();
    section
      .find(
        "script, style, nav, aside, footer, .ad-content, .box-body, .related, .share, button, form, .subscription"
      )
      .remove();
    const viaP = joinMeaningful($, section, "p")
      .split(/\n\n+/)
      .filter((p) => !/投稿請寄到|oped@thenewslens|一稿多投|來信請附上投稿人/.test(p))
      .join("\n\n");
    candidates.push(normalizeParagraphs(viaP));
  }

  // UDN
  if (host.includes("udn.com")) {
    const ed = $(".article-content__editor, .article-content").first().clone();
    ed.find("script, style, figure, .video-container, .social, .share").remove();
    candidates.push(joinMeaningful($, ed, "p"));
    candidates.push(
      normalizeParagraphs(
        ed
          .text()
          .replace(/\s+/g, " ")
          .replace(/twitter loading\.\.\./gi, "")
          .trim()
      )
    );
  }

  // LTN (often 403 from datacenter — still try)
  if (host.includes("ltn.com.tw")) {
    for (const sel of [
      "#newscotent",
      "#newscontent",
      ".text",
      ".article-text",
      ".boxTitle .text",
      "[data-desc=content]",
      ".whitecon .text",
    ]) {
      const el = $(sel).first().clone();
      if (!el.length) continue;
      el.find("script, style, .ad, .related, .app-ad").remove();
      const viaP = joinMeaningful($, el, "p");
      if (viaP) candidates.push(viaP);
      const raw = normalizeParagraphs(el.text().replace(/\s+/g, " "));
      if (raw.length > 80) candidates.push(raw);
    }
  }

  // Generic fallbacks (skip when site-specific selectors already ran)
  const knownHost =
    host.includes("cna.com.tw") ||
    host.includes("thenewslens.com") ||
    host.includes("udn.com") ||
    host.includes("ltn.com.tw");
  if (!knownHost) {
    for (const sel of [
      "[itemprop=articleBody]",
      "article",
      ".article-content",
      ".article-body",
      ".post-content",
      ".story-content",
      "main",
    ]) {
      const el = $(sel).first().clone();
      if (!el.length) continue;
      el.find(
        "script, style, nav, aside, footer, header, .ad, .share, .related, .social, form, button"
      ).remove();
      const viaP = joinMeaningful($, el, "p");
      if (viaP.length > 80) candidates.push(viaP);
    }
  }

  // Drop submission / chrome boilerplate that sometimes outranks real body length
  const cleaned = candidates.map((c) =>
    normalizeParagraphs(
      c
        .split(/\n\n+/)
        .filter(
          (p) =>
            !/投稿請寄到|oped@thenewslens|一稿多投|來信請附上投稿人|twitter loading/i.test(
              p
            )
        )
        .join("\n\n")
    )
  );

  return longestText(cleaned);
}

export type ScrapeResult = {
  body: string;
  scraped: boolean;
  status?: number;
  images?: string[];
};

/**
 * Best-effort article body scrape. Never invents text.
 * Returns empty body when the page is blocked or has no extractable content.
 */
export async function scrapeArticle(url: string): Promise<ScrapeResult> {
  const cacheKey = `news:scrape:${url}`;
  const cached = getCached<ScrapeResult>(cacheKey);
  if (cached) return cached;

  try {
    const { ok, status, html } = await fetchHtml(url, {
      userAgent: UA_CHROME,
      acceptLanguage: "zh-TW,zh;q=0.9,en;q=0.8",
    });
    if (!ok || !html || html.length < 200) {
      const result: ScrapeResult = { body: "", scraped: false, status };
      return setCache(cacheKey, result, BODY_CACHE_TTL);
    }
    const body = scrapeFromHtml(url, html);
    const images = extractNewsImages(url, html);
    const result: ScrapeResult = {
      body,
      scraped: body.length >= 80,
      status,
      images: images.length ? images : undefined,
    };
    return setCache(cacheKey, result, BODY_CACHE_TTL);
  } catch (err) {
    console.error(`[news] scrape failed for ${url}:`, err);
    const result: ScrapeResult = { body: "", scraped: false };
    return setCache(cacheKey, result, BODY_CACHE_TTL / 2);
  }
}

function buildNewsBody(opts: {
  scrapedBody: string;
  scraped: boolean;
  preview: string;
  url: string;
  status?: number;
}): string {
  const { scrapedBody, scraped, preview, url, status } = opts;
  const parts: string[] = [];

  if (scraped && scrapedBody) {
    parts.push(scrapedBody);
  } else {
    const fallback = longestText([scrapedBody, preview]);
    if (fallback) parts.push(fallback);
    const reason =
      status === 403
        ? "原文網站拒絕此環境的抓取（HTTP 403）"
        : status && status >= 400
          ? `原文網站回傳 HTTP ${status}`
          : "無法取得完整內文";
    parts.push(
      `\n※ ${reason}，以上為 RSS／預覽可見文字，請至原文查看完整報導。`
    );
  }

  if (url && url !== "#") {
    parts.push(`\n原文連結：${url}`);
  }
  return parts.join("\n").trim();
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
    const url = (params.url || "").trim();
    if (!url || url === "#") return null;

    const feed = await this.fetchFeed(40);
    const item =
      feed.find((x) => x.detailParams?.id === params.id) ||
      feed.find((x) => x.url === url) ||
      undefined;

    const scrape = await scrapeArticle(url);
    const title = item?.title || "新聞";
    const preview = item?.preview || "";

    const body = buildNewsBody({
      scrapedBody: scrape.body,
      scraped: scrape.scraped,
      preview,
      url,
      status: scrape.status,
    });

    const images = scrape.images?.length ? scrape.images : undefined;

    const post: Post = {
      id: item?.id || `news:${Buffer.from(url).toString("base64url").slice(0, 24)}`,
      source: "news",
      title,
      author: item?.author || "新聞",
      channel: item?.channel || "新聞",
      createdAt: item?.createdAt || new Date().toISOString(),
      preview: preview || body.slice(0, 180),
      body,
      url,
      images,
      comments: [],
      detailParams: {
        source: "news",
        id: item?.detailParams?.id || params.id || "",
        url,
      },
    };
    return post;
  },
};
