import type { FeedItem } from "@/lib/sources/types";
import type { ConfluenceGroup } from "@/lib/confluence";

export function engagementScore(item: FeedItem): number {
  const e = item.engagement;
  if (!e) return 0;
  return (e.pushes || 0) + (e.likes || 0) + (e.comments || 0) + (e.boos || 0) * 0.5;
}

/** Recency boost: fresher items score higher (0–1 scale over ~24h). */
function recencyScore(item: FeedItem): number {
  const t = new Date(item.createdAt).getTime();
  if (Number.isNaN(t)) return 0;
  const ageH = (Date.now() - t) / 3_600_000;
  return Math.max(0, 1 - ageH / 24);
}

/** Hotness for ticker / hero: engagement + recency + images + confluence. */
export function hotnessScore(
  item: FeedItem,
  confluenceMap?: Map<string, ConfluenceGroup>,
): number {
  const eng = engagementScore(item);
  const images = item.images?.length ?? 0;
  const group = confluenceMap?.get(item.id);
  const confBonus = group && group.memberIds.length >= 2 ? 25 + group.sources.length * 10 : 0;
  return eng * 2 + recencyScore(item) * 40 + images * 12 + confBonus;
}

/** Pick the hero spotlight item: confluence lead / most-imaged / hottest. */
export function pickHeroItem(
  items: FeedItem[],
  confluenceMap: Map<string, ConfluenceGroup>,
): FeedItem | null {
  if (items.length === 0) return null;
  const ranked = [...items].sort(
    (a, b) => hotnessScore(b, confluenceMap) - hotnessScore(a, confluenceMap),
  );
  return ranked[0] ?? null;
}

/** Top N items for the hot ticker. */
export function pickTickerItems(
  items: FeedItem[],
  confluenceMap: Map<string, ConfluenceGroup>,
  n = 8,
): FeedItem[] {
  return [...items]
    .sort((a, b) => hotnessScore(b, confluenceMap) - hotnessScore(a, confluenceMap))
    .slice(0, n);
}
