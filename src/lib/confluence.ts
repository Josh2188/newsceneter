import type { FeedItem } from "@/lib/sources/types";

/** Strip board tags, Re:, punctuation; keep CJK + alnum. */
export function normalizeTitle(title: string): string {
  let t = title
    .replace(/\[(?:正妹|問卦|新聞|爆卦|公告|情報|閒聊|心情|創作|分享|推薦|討論|求助|黑特|Gossiping|Beauty)\]/gi, "")
    .replace(/^Re:\s*/i, "")
    .replace(/^Fw:\s*/i, "")
    .toLowerCase();
  // Keep CJK, letters, digits; drop punctuation/spaces for token base
  t = t.replace(/[^\u4e00-\u9fff\u3400-\u4dbfa-z0-9]+/g, "");
  return t.trim();
}

/** Significant tokens: CJK bigrams + latin words length ≥ 2. */
export function titleTokens(normalized: string): Set<string> {
  const tokens = new Set<string>();
  const latin = normalized.match(/[a-z0-9]{2,}/g) || [];
  for (const w of latin) tokens.add(w);

  const cjk = normalized.replace(/[a-z0-9]+/g, "");
  if (cjk.length === 1) {
    tokens.add(cjk);
  } else {
    for (let i = 0; i < cjk.length - 1; i++) {
      tokens.add(cjk.slice(i, i + 2));
    }
  }
  return tokens;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface ConfluenceGroup {
  id: string;
  memberIds: string[];
  /** Prefer groups that span ≥2 sources when possible */
  sources: string[];
}

const DEFAULT_THRESHOLD = 0.35;

/**
 * Cluster similar headlines (Jaccard on significant bigrams/tokens).
 * Returns map: itemId → group (only for items in a group of size ≥ 2).
 */
export function clusterConfluence(
  items: FeedItem[],
  threshold = DEFAULT_THRESHOLD,
): Map<string, ConfluenceGroup> {
  const n = items.length;
  const norms = items.map((it) => normalizeTitle(it.title));
  const tokenSets = norms.map(titleTokens);
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }

  for (let i = 0; i < n; i++) {
    if (tokenSets[i].size < 2 && norms[i].length < 4) continue;
    for (let j = i + 1; j < n; j++) {
      if (tokenSets[j].size < 2 && norms[j].length < 4) continue;
      // Exact normalized match always clusters
      if (norms[i] && norms[i] === norms[j]) {
        union(i, j);
        continue;
      }
      const sim = jaccard(tokenSets[i], tokenSets[j]);
      if (sim >= threshold) union(i, j);
    }
  }

  const buckets = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const list = buckets.get(r) || [];
    list.push(i);
    buckets.set(r, list);
  }

  const result = new Map<string, ConfluenceGroup>();
  let gid = 0;
  for (const idxs of buckets.values()) {
    if (idxs.length < 2) continue;
    const members = idxs.map((i) => items[i]);
    const sources = [...new Set(members.map((m) => m.source))];
    const group: ConfluenceGroup = {
      id: `cf-${gid++}`,
      memberIds: members.map((m) => m.id),
      sources,
    };
    for (const m of members) {
      result.set(m.id, group);
    }
  }
  return result;
}

export function detailHref(item: FeedItem): string {
  const p = item.detailParams || { source: item.source, id: item.id };
  const q = new URLSearchParams(p);
  return `/post?${q.toString()}`;
}
