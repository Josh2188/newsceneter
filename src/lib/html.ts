/** Shared HTML fetch / text helpers for source scrapers. */

export const UA_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const UA_GOOGLEBOT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

export async function fetchHtml(
  url: string,
  options?: {
    userAgent?: string;
    acceptLanguage?: string;
    extraHeaders?: Record<string, string>;
    /** Next.js fetch cache TTL in seconds. Default 120. */
    revalidate?: number;
  }
): Promise<{ ok: boolean; status: number; html: string }> {
  const revalidate = options?.revalidate ?? 120;
  const res = await fetch(url, {
    headers: {
      "User-Agent": options?.userAgent || UA_CHROME,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": options?.acceptLanguage || "zh-TW,zh;q=0.9,en;q=0.8",
      ...(options?.extraHeaders || {}),
    },
    redirect: "follow",
    next: { revalidate },
  });
  const html = await res.text();
  return { ok: res.ok, status: res.status, html };
}

/** Prefer the longest non-trivial candidate string. */
export function longestText(candidates: Array<string | null | undefined>): string {
  let best = "";
  for (const c of candidates) {
    const t = (c || "").replace(/\u00a0/g, " ").trim();
    if (t.length > best.length) best = t;
  }
  return best;
}

export function normalizeParagraphs(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
