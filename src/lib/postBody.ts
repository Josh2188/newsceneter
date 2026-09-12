/** Pure text shaping for post detail bodies. Never invents wording. */

export type BodyBlock =
  | { type: "p"; text: string }
  | { type: "note"; text: string }
  | { type: "quote"; text: string }
  | { type: "sep" };

const SENTENCE_END_RE = /[。！？!?]/;
const TRAILING_PUNCT_RE = /[.,;:!?。，、；：]+$/;
const SOURCE_LINK_RE =
  /(?:\n+\s*)?(?:原文連結|原文)[：:]\s*https?:\/\/\S+\s*$/u;
const URL_RE = /https?:\/\/[^\s<>"'[\]）】》\u3000]+/gi;

const OPEN_TO_CLOSE: Record<string, string> = {
  "「": "」",
  "『": "』",
  "（": "）",
  "(": ")",
  "【": "】",
  "《": "》",
  "〈": "〉",
  "“": "”",
};

const CLOSERS = new Set<string>([
  "」",
  "』",
  "）",
  ")",
  "】",
  "》",
  "〉",
  "”",
  "’",
  '"',
  "'",
]);

export function stripTrailingSourceLink(text: string): string {
  return text.replace(SOURCE_LINK_RE, "").trim();
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
}

/** Peel trailing sentence punctuation that often sticks to a scraped URL. */
export function peelUrl(raw: string): { url: string; trailing: string } {
  let url = raw;
  let trailing = "";
  while (url && TRAILING_PUNCT_RE.test(url.slice(-1))) {
    trailing = url.slice(-1) + trailing;
    url = url.slice(0, -1);
  }
  return { url, trailing };
}

export function findUrls(text: string): string[] {
  const out: string[] = [];
  const re = new RegExp(URL_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(peelUrl(m[0]).url);
  }
  return out;
}

function urlKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return url.replace(/\/$/, "").toLowerCase();
  }
}

export function shouldHideImageUrl(url: string, images: string[]): boolean {
  if (!images.length) return false;
  const n = urlKey(url);
  return images.some((img) => {
    const m = urlKey(img);
    return n === m || n.startsWith(m) || m.startsWith(n);
  });
}

/** East-Asian / ASCII display width (CJK ≈ 2, ASCII ≈ 1). */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) || 0;
    w += cp > 0x2e7f ? 2 : 1;
  }
  return w;
}

function endsSentence(s: string): boolean {
  const t = s.replace(/[\s」』）)】》〉"”'’]+$/u, "");
  return SENTENCE_END_RE.test(t.slice(-1));
}

function consumeClosers(text: string, i: number): number {
  let j = i + 1;
  while (j < text.length && CLOSERS.has(text[j])) j++;
  return j - 1;
}

/**
 * Split a long CJK blob after sentence punctuation once the current
 * paragraph is past ~80–120 characters. Does not break inside quotes.
 */
export function segmentCjk(text: string, minLen = 80): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return [];
  if (t.length <= minLen + 20) return [t];

  const stack: string[] = [];
  const paras: string[] = [];
  let start = 0;

  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    const closer = OPEN_TO_CLOSE[ch];
    if (closer) {
      stack.push(closer);
    } else if (stack.length && ch === stack[stack.length - 1]) {
      stack.pop();
    }

    if (stack.length === 0 && SENTENCE_END_RE.test(ch)) {
      const end = consumeClosers(t, i);
      const chunk = t.slice(start, end + 1);
      if (chunk.replace(/\s/g, "").length >= minLen) {
        const trimmed = chunk.trim();
        if (trimmed) paras.push(trimmed);
        start = end + 1;
        while (start < t.length && /\s/.test(t[start])) start++;
        i = start - 1;
      } else {
        i = end;
      }
    }
  }

  const rest = t.slice(start).trim();
  if (rest) paras.push(rest);
  return paras.length ? paras : [t];
}

function almostNoBreaks(text: string): boolean {
  const doubles = (text.match(/\n\n+/g) || []).length;
  const singles = (text.match(/\n/g) || []).length;
  if (doubles >= 2) return false;
  if (doubles === 1 && text.length < 400) return false;
  if (singles <= 2) return true;
  return singles / Math.max(text.length, 1) < 0.008;
}

function isNoteText(s: string): boolean {
  return /^※/.test(s.trim());
}

function pushTextBlock(out: BodyBlock[], text: string): void {
  const t = text.trim();
  if (!t) return;
  if (isNoteText(t)) {
    out.push({ type: "note", text: t });
    return;
  }
  out.push({ type: "p", text: t });
}

/** News / Threads: paragraphs + optional CJK segmentation. */
export function parseArticleBlocks(
  body: string,
  source: "news" | "threads"
): BodyBlock[] {
  let text = stripTrailingSourceLink(normalizeNewlines(body));
  // Fullwidth indent is a paragraph hint in some Taiwanese news.
  text = text.replace(/　　+/g, "\n\n");
  if (!text) return [];

  const out: BodyBlock[] = [];

  const applySegment = source === "news" || almostNoBreaks(text);

  if (almostNoBreaks(text)) {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const notes = lines.filter(isNoteText);
    const main = lines.filter((l) => !isNoteText(l)).join("");
    if (main) {
      const parts = applySegment ? segmentCjk(main) : [main];
      for (const p of parts) pushTextBlock(out, p);
    }
    for (const n of notes) pushTextBlock(out, n);
    return out;
  }

  const chunks = text.split(/\n\n+/);
  for (const chunk of chunks) {
    const raw = chunk.trim();
    if (!raw) continue;
    if (isNoteText(raw)) {
      // Each ※ line is its own callout.
      for (const line of raw.split("\n")) {
        if (line.trim()) pushTextBlock(out, line);
      }
      continue;
    }

    const lines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length <= 1) {
      const p = lines[0] || raw;
      if (applySegment && p.length > 160) {
        for (const part of segmentCjk(p)) pushTextBlock(out, part);
      } else {
        pushTextBlock(out, p);
      }
      continue;
    }

    // Single newlines: treat as paragraph breaks when lines look like
    // sentences; otherwise join (soft wrap leftovers).
    const longish = lines.filter((l) => l.length >= 36).length;
    if (longish >= lines.length - 1 && lines.length >= 2) {
      for (const line of lines) {
        if (applySegment && line.length > 200) {
          for (const part of segmentCjk(line)) pushTextBlock(out, part);
        } else {
          pushTextBlock(out, line);
        }
      }
    } else {
      const joined = lines.join("");
      if (applySegment && joined.length > 160) {
        for (const part of segmentCjk(joined)) pushTextBlock(out, part);
      } else {
        pushTextBlock(out, joined);
      }
    }
  }

  return out;
}

function joinSoft(a: string, b: string): string {
  if (/https?:\/\/\S+$/i.test(a) && /^[^\s]/.test(b)) return a + b;
  if (/[A-Za-z0-9/%]$/.test(a) && /^[A-Za-z0-9]/.test(b)) return a + " " + b;
  return a + b;
}

function looksLikeListOrHeading(line: string): boolean {
  return /^(?:[-*●○]|\d+[.)、.]|【[^】]{0,20}】)\s/.test(line);
}

/**
 * PTT 78-col soft wrap: join when the previous line does not finish a
 * sentence. Width is a hint so short titles / one-word lines stay separate.
 */
function shouldUnwrap(prev: string, next: string, mode: "p" | "quote"): boolean {
  const a = prev.replace(/\s+$/g, "");
  const b = next.replace(/\s+$/g, "");
  if (!a || !b) return false;
  if (endsSentence(a)) return false;
  if (/^※/.test(b) || /^--+$/.test(b)) return false;
  if (looksLikeListOrHeading(b)) return false;
  if (/https?:\/\/\S+$/i.test(a) && /^[^\s]/.test(b)) return true;
  const pw = displayWidth(a);
  if (mode === "quote") {
    // Quoted passages are usually one thought; only keep a line break when
    // the previous quote line already finished a sentence (handled above).
    return pw >= 20 || displayWidth(b) >= 12;
  }
  if (pw >= 64) return true; // classic ~78-col wrap
  if (pw >= 44 && displayWidth(b) >= 12) return true;
  return false;
}

function isQuoteLine(line: string): boolean {
  return /^[:：>]\s?/.test(line);
}

function quoteContent(line: string): string {
  return line.replace(/^[:：>]\s?/, "");
}

function isBareImageLine(line: string, hideImages?: string[]): boolean {
  const t = line.trim();
  if (!t || !hideImages?.length) return false;
  const urls = findUrls(t);
  if (urls.length !== 1) return false;
  const without = t.replace(urls[0], "").replace(/\s/g, "");
  if (without.length > 2) return false;
  return shouldHideImageUrl(urls[0], hideImages);
}

/** PTT: unwrap 78-col soft wraps; keep blank lines, quotes, ※ notes. */
export function parsePttBlocks(
  body: string,
  hideImages?: string[]
): BodyBlock[] {
  const text = stripTrailingSourceLink(normalizeNewlines(body));
  if (!text) return [];

  const lines = text.split("\n");
  const out: BodyBlock[] = [];

  type Open = { type: "p" | "quote"; text: string; last: string };
  let cur: Open | null = null;

  const flush = () => {
    if (!cur) return;
    const t = cur.text.trim();
    if (t) {
      out.push({ type: cur.type, text: t });
    }
    cur = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, "");
    const trimmed = line.trim();

    if (!trimmed) {
      flush();
      continue;
    }

    if (isBareImageLine(trimmed, hideImages)) {
      flush();
      continue;
    }

    if (/^--+$/.test(trimmed)) {
      flush();
      out.push({ type: "sep" });
      continue;
    }

    if (isNoteText(trimmed)) {
      flush();
      out.push({ type: "note", text: trimmed });
      continue;
    }

    if (isQuoteLine(line.trimStart())) {
      const content = quoteContent(line.trimStart());
      if (cur?.type === "quote") {
        if (shouldUnwrap(cur.last, content, "quote")) {
          cur.text = joinSoft(cur.text, content);
          cur.last = content;
        } else {
          cur.text += (cur.text ? "\n" : "") + content;
          cur.last = content;
        }
      } else {
        flush();
        cur = { type: "quote", text: content, last: content };
      }
      continue;
    }

    if (cur?.type === "p" && shouldUnwrap(cur.last, trimmed, "p")) {
      cur.text = joinSoft(cur.text, trimmed);
      cur.last = trimmed;
      continue;
    }

    if (cur?.type === "p") {
      // Short continuation of a URL split across a wrap that was just under
      // the width threshold (common for imgur).
      if (/https?:\/\/\S+$/i.test(cur.last) && /^[^\s]/.test(trimmed)) {
        cur.text = joinSoft(cur.text, trimmed);
        cur.last = trimmed;
        continue;
      }
      flush();
    } else {
      flush();
    }

    cur = { type: "p", text: trimmed, last: trimmed };
  }

  flush();
  return out;
}

export function parsePostBlocks(
  body: string,
  source: "ptt" | "threads" | "news",
  hideImages?: string[]
): BodyBlock[] {
  if (source === "ptt") return parsePttBlocks(body, hideImages);
  return parseArticleBlocks(body, source);
}
