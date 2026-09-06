/** Minimal RSS/Atom item parsing shared by news + RSSHub fallbacks. */

export function decodeXml(s: string): string {
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

export function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  return m ? decodeXml(m[1]) : "";
}

export type RssFields = {
  title: string;
  link: string;
  desc: string;
  pub: string;
  author: string;
};

export function parseRssItems(xml: string, limit = 12): RssFields[] {
  const out: RssFields[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of blocks.slice(0, limit)) {
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const desc = extractTag(block, "description");
    const pub = extractTag(block, "pubDate");
    const author =
      extractTag(block, "dc:creator") || extractTag(block, "author") || "";
    if (!title && !link) continue;
    out.push({ title, link, desc, pub, author });
  }
  return out;
}

export function rssHubBase(): string | null {
  const raw = process.env.RSSHUB_BASE?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export async function fetchRssXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "NewsCeneter/0.1 (RSS reader)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`RSS HTTP ${res.status} for ${url}`);
  return res.text();
}
