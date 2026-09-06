import { getCached, setCache } from "../cache";
import type { FeedItem, Post, Source } from "./types";
import {
  fetchRssXml,
  parseRssItems,
  rssHubBase,
} from "./rssParse";

const CACHE_TTL = 60_000;
const GRAPH_FB = "https://graph.facebook.com/v21.0";
const GRAPH_IG = "https://graph.instagram.com";

/** Mutable last-error for river / banner aggregation. */
export let instagramLastError: string | null = null;

function getMetaToken(): string | null {
  return (
    process.env.META_ACCESS_TOKEN?.trim() ||
    process.env.FACEBOOK_ACCESS_TOKEN?.trim() ||
    null
  );
}

function getIgLoginToken(): string | null {
  return process.env.INSTAGRAM_ACCESS_TOKEN?.trim() || null;
}

function getUserIds(): string[] {
  const raw = process.env.INSTAGRAM_USER_IDS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

type IgMedia = {
  id?: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

function mediaToItem(userLabel: string, m: IgMedia): FeedItem | null {
  const text = (m.caption || "").trim();
  const id = m.id;
  if (!id) return null;
  const title =
    text.split("\n").find((l) => l.trim())?.trim().slice(0, 80) ||
    `${userLabel} 貼文`;
  const createdAt = m.timestamp
    ? new Date(m.timestamp).toISOString()
    : new Date().toISOString();
  return {
    id: `instagram:${id}`,
    source: "instagram",
    title,
    author: userLabel,
    channel: userLabel,
    createdAt: Number.isNaN(Date.parse(createdAt))
      ? new Date().toISOString()
      : createdAt,
    preview: text.replace(/\s+/g, " ").slice(0, 180) || title,
    url: m.permalink || `https://www.instagram.com/p/${id}/`,
    engagement: {
      likes: m.like_count,
      comments: m.comments_count,
    },
    detailParams: {
      source: "instagram",
      id,
      user: userLabel,
    },
  };
}

const MEDIA_FIELDS =
  "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count";

async function fetchIgUserGraph(
  igUserId: string,
  token: string,
  limit: number
): Promise<FeedItem[]> {
  const url =
    `${GRAPH_FB}/${encodeURIComponent(igUserId)}/media` +
    `?fields=${encodeURIComponent(MEDIA_FIELDS)}` +
    `&limit=${Math.min(Math.max(limit, 1), 25)}` +
    `&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  const json = (await res.json()) as {
    data?: IgMedia[];
    error?: { message?: string };
  };
  if (!res.ok || json.error) {
    throw new Error(
      json.error?.message || `IG Graph HTTP ${res.status} for ${igUserId}`
    );
  }
  const items: FeedItem[] = [];
  for (const m of json.data || []) {
    const item = mediaToItem(igUserId, m);
    if (item) {
      items.push(item);
      setCache(
        `instagram:body:${item.detailParams!.id}`,
        { text: m.caption || item.preview, item },
        CACHE_TTL * 2
      );
    }
  }
  return items;
}

/** Instagram Login host: GET graph.instagram.com/me/media */
async function fetchIgMeMedia(
  token: string,
  limit: number
): Promise<FeedItem[]> {
  const url =
    `${GRAPH_IG}/me/media` +
    `?fields=${encodeURIComponent(MEDIA_FIELDS)}` +
    `&limit=${Math.min(Math.max(limit, 1), 25)}` +
    `&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  const json = (await res.json()) as {
    data?: IgMedia[];
    error?: { message?: string };
  };
  if (!res.ok || json.error) {
    throw new Error(
      json.error?.message || `IG Login Graph HTTP ${res.status}`
    );
  }
  const items: FeedItem[] = [];
  for (const m of json.data || []) {
    const item = mediaToItem("me", m);
    if (item) {
      items.push(item);
      setCache(
        `instagram:body:${item.detailParams!.id}`,
        { text: m.caption || item.preview, item },
        CACHE_TTL * 2
      );
    }
  }
  return items;
}

async function fetchUserRssHub(user: string): Promise<FeedItem[]> {
  const base = rssHubBase();
  if (!base) return [];
  const xml = await fetchRssXml(
    `${base}/instagram/user/${encodeURIComponent(user)}`
  );
  const items: FeedItem[] = [];
  for (const r of parseRssItems(xml, 12)) {
    const title = r.title || `${user} 貼文`;
    const idSafe = Buffer.from(`${user}:${r.link || title}`)
      .toString("base64url")
      .slice(0, 24);
    const createdAt = r.pub
      ? new Date(r.pub).toISOString()
      : new Date().toISOString();
    const item: FeedItem = {
      id: `instagram:rss:${idSafe}`,
      source: "instagram",
      title,
      author: r.author || user,
      channel: user,
      createdAt: Number.isNaN(Date.parse(createdAt))
        ? new Date().toISOString()
        : createdAt,
      preview: (r.desc || title).replace(/\s+/g, " ").slice(0, 180),
      url: r.link || "#",
      detailParams: {
        source: "instagram",
        id: idSafe,
        user,
        url: r.link || "",
      },
    };
    if (item.url === "#") continue;
    items.push(item);
    setCache(
      `instagram:body:${idSafe}`,
      { text: r.desc || title, item },
      CACHE_TTL * 2
    );
  }
  return items;
}

async function fetchOneUser(
  userId: string,
  limit: number
): Promise<FeedItem[]> {
  const cacheKey = `instagram:user:${userId}`;
  const cached = getCached<FeedItem[]>(cacheKey);
  if (cached) return cached;

  const token = getMetaToken();
  let items: FeedItem[] = [];

  if (token) {
    try {
      items = await fetchIgUserGraph(userId, token, limit);
    } catch (err) {
      console.error(`[instagram] Graph ${userId}:`, err);
    }
  }

  if (items.length === 0 && rssHubBase()) {
    try {
      items = await fetchUserRssHub(userId);
    } catch (err) {
      console.error(`[instagram] RSSHub ${userId}:`, err);
    }
  }

  if (items.length === 0) return [];
  return setCache(cacheKey, items, CACHE_TTL);
}

export const instagramSource: Source = {
  id: "instagram",
  label: "Instagram",
  async fetchFeed(limit = 20) {
    instagramLastError = null;
    const cacheKey = `instagram:feed:${limit}`;
    const cached = getCached<FeedItem[]>(cacheKey);
    if (cached) return cached;

    const metaToken = getMetaToken();
    const igToken = getIgLoginToken();
    const hub = rssHubBase();
    const userIds = getUserIds();

    if (!metaToken && !igToken && !hub) {
      instagramLastError =
        "Instagram 需要 META_ACCESS_TOKEN 與 INSTAGRAM_USER_IDS（或 INSTAGRAM_ACCESS_TOKEN）；請於 Graph Explorer 查 /me/accounts";
      console.error("[instagram]", instagramLastError);
      return [];
    }

    const batches: FeedItem[][] = [];

    if (igToken) {
      try {
        batches.push(await fetchIgMeMedia(igToken, limit));
      } catch (err) {
        console.error("[instagram] Login /me/media:", err);
      }
    }

    if (userIds.length > 0) {
      const per = Math.ceil(limit / Math.max(userIds.length, 1)) + 3;
      const userBatches = await Promise.all(
        userIds.map((u) => fetchOneUser(u, per))
      );
      batches.push(...userBatches);
    } else if (!igToken && hub) {
      console.warn(
        "[instagram] INSTAGRAM_USER_IDS empty; set numeric IG business/creator ids"
      );
    }

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
      if (!metaToken && !igToken) {
        instagramLastError =
          "Instagram 無 token，且 RSSHub 後備亦無資料（請設定 META_ACCESS_TOKEN／INSTAGRAM_ACCESS_TOKEN 或 RSSHUB_BASE）";
      } else if (userIds.length === 0 && !igToken) {
        instagramLastError =
          "請設定 INSTAGRAM_USER_IDS（數值型 IG 商業／創作者帳號 ID）";
      } else {
        instagramLastError =
          "Instagram Graph／RSSHub 皆無法取得貼文（請檢查權限與 IG User ID）";
      }
      console.error("[instagram]", instagramLastError);
      return [];
    }
    return setCache(cacheKey, items, CACHE_TTL);
  },
  async fetchPost(params) {
    const id = params.id;
    if (!id) return null;
    const bodyCached = getCached<{ text: string; item: FeedItem }>(
      `instagram:body:${id}`
    );
    if (bodyCached) {
      return { ...bodyCached.item, body: bodyCached.text } satisfies Post;
    }
    const feed = await this.fetchFeed(40);
    const item =
      feed.find((x) => x.detailParams?.id === id) ||
      feed.find((x) => x.id === `instagram:${id}`) ||
      feed.find((x) => x.id === `instagram:rss:${id}`);
    if (!item) return null;
    const body = getCached<{ text: string; item: FeedItem }>(
      `instagram:body:${id}`
    );
    return {
      ...item,
      body: body?.text || item.preview,
    } satisfies Post;
  },
};
