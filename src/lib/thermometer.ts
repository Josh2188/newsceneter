import type { FeedItem } from "@/lib/sources/types";

export type TempLabel = "冰涼" | "微溫" | "滾燙" | "沸騰";

export interface ThermometerStats {
  label: TempLabel;
  /** 0–100 for the meter bar */
  score: number;
  breakdown: string;
  pttPct: number;
  threadsPct: number;
  newsPct: number;
  freshPct: number;
  engagementHeat: number;
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function engagementScore(item: FeedItem): number {
  const e = item.engagement;
  if (!e) return 0;
  return (e.pushes || 0) + (e.likes || 0) + (e.comments || 0) + (e.boos || 0);
}

function labelFor(score: number): TempLabel {
  if (score >= 75) return "沸騰";
  if (score >= 50) return "滾燙";
  if (score >= 25) return "微溫";
  return "冰涼";
}

/** Client-side “river temperature” from currently loaded items. */
export function computeThermometer(items: FeedItem[]): ThermometerStats {
  const n = items.length;
  if (n === 0) {
    return {
      label: "冰涼",
      score: 0,
      breakdown: "河道空空如也",
      pttPct: 0,
      threadsPct: 0,
      newsPct: 0,
      freshPct: 0,
      engagementHeat: 0,
    };
  }

  let ptt = 0;
  let threads = 0;
  let news = 0;
  let fresh = 0;
  let engSum = 0;
  const now = Date.now();

  for (const item of items) {
    if (item.source === "ptt") ptt++;
    else if (item.source === "threads") threads++;
    else if (item.source === "news") news++;
    const t = new Date(item.createdAt).getTime();
    if (!Number.isNaN(t) && now - t <= TWO_HOURS_MS) fresh++;
    engSum += engagementScore(item);
  }

  const pttPct = Math.round((ptt / n) * 100);
  const threadsPct = Math.round((threads / n) * 100);
  const newsPct = Math.max(0, 100 - pttPct - threadsPct);
  const freshPct = Math.round((fresh / n) * 100);

  // Engagement: normalize by item count; ~30 avg heat ≈ full meter contrib
  const avgEng = engSum / n;
  const engNorm = Math.min(100, (avgEng / 30) * 100);

  // Mix diversity: more even mix → slightly hotter (river is lively)
  const mixParts = [ptt, threads, news].filter((c) => c > 0).length;
  const mixBonus = mixParts >= 3 ? 15 : mixParts === 2 ? 8 : 0;

  const score = Math.round(
    Math.min(100, freshPct * 0.45 + engNorm * 0.4 + mixBonus + (avgEng > 0 ? 5 : 0)),
  );

  const breakdown = `PTT ${pttPct}% · Threads ${threadsPct}% · 新聞 ${newsPct}% · 新鮮 ${freshPct}%`;

  return {
    label: labelFor(score),
    score,
    breakdown,
    pttPct,
    threadsPct,
    newsPct,
    freshPct,
    engagementHeat: Math.round(avgEng),
  };
}
