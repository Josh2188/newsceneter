import * as cheerio from "cheerio";
import { getCached, setCache } from "../cache";
import {
  absoluteUrl,
  dedupeUrls,
  looksLikeImageUrl,
} from "../images";
import type { Comment, FeedItem, Post, Source } from "./types";

const BASE = "https://www.ptt.cc";
const BOARDS = ["Gossiping", "Beauty", "Stock", "Baseball", "Mobilesales"] as const;
const CACHE_TTL = 45_000;
const UA =
  "Mozilla/5.0 (compatible; NewsCeneter/0.1; +https://localhost) AppleWebKit/537.36";

async function pttFetch(path: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Cookie: "over18=1",
      Accept: "text/html,application/xhtml+xml",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`PTT HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

function parseListTime(raw: string, now = new Date()): string {
  // Index shows MM/DD; invent a reasonable ISO (assume current year, noon UTC+8)
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return now.toISOString();
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = now.getFullYear();
  // Taiwan local noon -> UTC
  const d = new Date(Date.UTC(year, month - 1, day, 4, 0, 0));
  // If far in the future, roll back a year
  if (d.getTime() - now.getTime() > 2 * 24 * 3600 * 1000) {
    d.setUTCFullYear(year - 1);
  }
  return d.toISOString();
}

function parseArticleTime(raw: string): string {
  // e.g. "Sun Sep  6 12:34:56 2026"
  const d = new Date(raw.trim());
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return new Date().toISOString();
}

function articleIdFromHref(href: string): string | null {
  const m = href.match(/\/bbs\/([^/]+)\/(M\.\d+\.A\.[A-Z0-9]+)\.html/);
  return m ? m[2] : null;
}

function boardFromHref(href: string): string | null {
  const m = href.match(/\/bbs\/([^/]+)\//);
  return m ? m[1] : null;
}

async function fetchBoardIndex(board: string, limit: number): Promise<FeedItem[]> {
  const cacheKey = `ptt:list:${board}:${limit}`;
  const cached = getCached<FeedItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const html = await pttFetch(`/bbs/${board}/index.html`);
    const $ = cheerio.load(html);
    const items: FeedItem[] = [];

    $(".r-ent").each((_, el) => {
      if (items.length >= limit) return;
      const titleEl = $(el).find(".title a");
      const href = titleEl.attr("href");
      if (!href || !titleEl.text().trim()) return;
      // Skip deleted / empty
      const title = titleEl.text().trim();
      const author = $(el).find(".meta .author").text().trim() || "匿名";
      const dateRaw = $(el).find(".meta .date").text().trim();
      const nrec = $(el).find(".nrec").text().trim();
      let pushes = 0;
      if (nrec === "爆") pushes = 100;
      else if (/^\d+$/.test(nrec)) pushes = Number(nrec);

      const id = articleIdFromHref(href);
      if (!id) return;

      items.push({
        id: `ptt:${board}:${id}`,
        source: "ptt",
        title,
        author,
        channel: board,
        createdAt: parseListTime(dateRaw),
        preview: `${board} · ${author}`,
        url: `${BASE}${href}`,
        engagement: { pushes },
        detailParams: { source: "ptt", board, id },
      });
    });

    return setCache(cacheKey, items, CACHE_TTL);
  } catch (err) {
    console.error(`[ptt] board ${board} failed:`, err);
    return [];
  }
}

function parsePushes($: cheerio.CheerioAPI): Comment[] {
  const comments: Comment[] = [];
  $(".push").each((i, el) => {
    const tag = $(el).find(".push-tag").text().trim();
    const author = $(el).find(".push-userid").text().trim();
    const body = $(el).find(".push-content").text().replace(/^:\s*/, "").trim();
    const ipdate = $(el).find(".push-ipdatetime").text().trim();
    let type: Comment["type"] = "comment";
    if (tag.startsWith("推")) type = "push";
    else if (tag.startsWith("噓")) type = "boo";
    else if (tag.startsWith("→")) type = "arrow";
    comments.push({
      id: `push-${i}`,
      author,
      body,
      createdAt: ipdate || undefined,
      type,
    });
  });
  return comments;
}


function extractPttImages(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const found: string[] = [];

  // <img src> in article
  $("#main-content img[src], #main-content img[data-src]").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || "";
    const abs = absoluteUrl(src, pageUrl);
    if (abs) found.push(abs);
  });

  // Anchors pointing at image files
  $("#main-content a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const abs = absoluteUrl(href, pageUrl);
    if (abs && looksLikeImageUrl(abs)) found.push(abs);
  });

  // Plain URLs in article text (imgur etc.)
  const main = $("#main-content").clone();
  main.find(".article-metaline, .article-metaline-right, .push").remove();
  const bodyText = main.text();
  const urlRe =
    /https?:\/\/[^\s<>"'\]\)]+/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(bodyText)) !== null) {
    let raw = m[0].replace(/[.,;:!?)]+$/, "");
    const abs = absoluteUrl(raw, pageUrl);
    if (!abs) continue;
    if (looksLikeImageUrl(abs)) {
      found.push(abs);
      continue;
    }
    // bare imgur album/page often resolves as image via i.imgur.com/<id>.jpg — keep gallery pages only if ext present
    try {
      const u = new URL(abs);
      if (
        /(^|\.)imgur\.com$/i.test(u.hostname) &&
        /\/(?:[A-Za-z0-9]{5,})\.(?:jpe?g|png|gif|webp)$/i.test(u.pathname)
      ) {
        found.push(abs);
      }
    } catch {
      /* ignore */
    }
  }

  return dedupeUrls(found);
}

async function fetchArticle(board: string, id: string): Promise<Post | null> {
  const cacheKey = `ptt:post:${board}:${id}`;
  const cached = getCached<Post>(cacheKey);
  if (cached) return cached;

  try {
    const path = `/bbs/${board}/${id}.html`;
    const html = await pttFetch(path);
    const $ = cheerio.load(html);

    const meta: Record<string, string> = {};
    $(".article-metaline").each((_, el) => {
      const tag = $(el).find(".article-meta-tag").text().trim();
      const value = $(el).find(".article-meta-value").text().trim();
      meta[tag] = value;
    });

    // Remove metalines and pushes from main content clone
    const main = $("#main-content").clone();
    main.find(".article-metaline, .article-metaline-right, .push").remove();
    let body = main.text().trim();
    // Strip leading "作者/標題/時間" leftovers if any
    body = body.replace(/^※.*$/gm, (line) => line).trim();

    const comments = parsePushes($);
    const pushes = comments.filter((c) => c.type === "push").length;
    const boos = comments.filter((c) => c.type === "boo").length;
    const arrows = comments.filter((c) => c.type === "arrow").length;

    const title = meta["標題"] || id;
    const author = (meta["作者"] || "").split(" ")[0] || "匿名";
    const createdAt = meta["時間"]
      ? parseArticleTime(meta["時間"])
      : new Date().toISOString();

    const preview = body.slice(0, 160).replace(/\s+/g, " ");
    const pageUrl = `${BASE}${path}`;
    const images = extractPttImages(html, pageUrl);

    const post: Post = {
      id: `ptt:${board}:${id}`,
      source: "ptt",
      title,
      author,
      channel: board,
      createdAt,
      preview,
      body,
      url: pageUrl,
      images: images.length ? images : undefined,
      engagement: { pushes, boos, arrows, comments: comments.length },
      comments,
      detailParams: { source: "ptt", board, id },
    };

    return setCache(cacheKey, post, CACHE_TTL);
  } catch (err) {
    console.error(`[ptt] article ${board}/${id} failed:`, err);
    return null;
  }
}

export const pttSource: Source = {
  id: "ptt",
  label: "PTT",
  async fetchFeed(limit = 20) {
    const perBoard = Math.max(3, Math.ceil(limit / BOARDS.length));
    const results = await Promise.all(
      BOARDS.map((b) => fetchBoardIndex(b, perBoard))
    );
    return results.flat().slice(0, limit * 2);
  },
  async fetchPost(params) {
    const board = params.board;
    const id = params.id;
    if (!board || !id) return null;
    return fetchArticle(board, id);
  },
};

export { fetchArticle, BOARDS };
