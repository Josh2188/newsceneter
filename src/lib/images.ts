/** Shared image URL helpers for source scrapers. */

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp)(\?|#|$)/i;
const KNOWN_HOST_RE =
  /(?:^|\.)(?:imgur\.com|i\.imgur\.com|pbs\.twimg\.com|cdninstagram\.com|fbcdn\.net|googleusercontent\.com|pinimg\.com|redd\.it|twimg\.com|urusai\.cc)/i;

export function absoluteUrl(href: string, base: string): string | null {
  const raw = (href || "").trim();
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return null;
  try {
    return new URL(raw, base).href;
  } catch {
    return null;
  }
}

export function looksLikeImageUrl(url: string): boolean {
  if (!url || url.startsWith("data:")) return false;
  if (IMAGE_EXT_RE.test(url)) return true;
  try {
    const u = new URL(url);
    if (KNOWN_HOST_RE.test(u.hostname)) return true;
    if (/[?&]format=(jpe?g|png|webp|gif)/i.test(u.search)) return true;
  } catch {
    return false;
  }
  return false;
}

/** Canonical key for dedupe (strip volatile CDN query on IG/FB hosts). */
function dedupeKey(url: string): string {
  try {
    const u = new URL(url);
    if (
      /cdninstagram\.com$|fbcdn\.net$|instagram\.com$/i.test(u.hostname)
    ) {
      return `${u.hostname}${u.pathname}`;
    }
    return url;
  } catch {
    return url;
  }
}

/** Dedupe while preserving order; drop empties / data URIs. */
export function dedupeUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const t = (u || "").trim();
    if (!t || t.startsWith("data:")) continue;
    const key = dedupeKey(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Reject logos, icons, tracking pixels, tiny placeholders, ads, UI chrome. */
export function isJunkImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.startsWith("data:")) return true;
  if (
    /(?:logo|icon|favicon|sprite|avatar|emoji|badge|button|pixel|tracking|spacer|1x1|blank\.|transparent|bt-x|close[-_]?btn)/i.test(
      lower
    )
  ) {
    return true;
  }
  if (
    /(?:\/ads?\/|\/ad[-_]|doubleclick|googlesyndication|adserver|analytics)/i.test(
      lower
    )
  ) {
    return true;
  }
  // Site chrome / static UI assets (LTN assets/, share widgets, etc.)
  if (/\/assets\/images\//i.test(lower)) return true;
  if (/\/(?:share|social|widget|toolbar)\//i.test(lower)) return true;
  // Tiny dimension filenames like 16x16, 400s.jpg size badges
  if (/[_-](?:16|24|32|48|64)x(?:16|24|32|48|64)(?:[_./?]|$)/i.test(lower)) {
    return true;
  }
  if (/\/(?:\d{2,3}s)\.(?:jpe?g|png|gif|webp)(?:\?|#|$)/i.test(lower)) {
    return true;
  }
  if (/1x1|pixel\.gif|spacer\.gif/i.test(lower)) return true;
  return false;
}

export function pickBestCandidate(
  candidates: Array<
    { url?: string; width?: number; height?: number } | null | undefined
  >
): string | null {
  const valid = candidates
    .filter((c): c is { url: string; width?: number; height?: number } =>
      Boolean(c && typeof c.url === "string" && c.url)
    )
    .filter((c) => !c.url.startsWith("data:"));
  if (!valid.length) return null;
  valid.sort(
    (a, b) =>
      (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0)
  );
  return valid[0].url;
}
