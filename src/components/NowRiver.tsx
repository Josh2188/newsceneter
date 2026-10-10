"use client";

import { useEffect, useMemo, useState } from "react";
import type { FeedItem } from "@/lib/sources/types";
import type { ThermometerStats } from "@/lib/thermometer";

const TEMP_LINES: Record<string, string[]> = {
  冰涼: ["河道靜悄悄，適合慢慢漂。", "低溫夜航——偶爾也挺舒服。"],
  微溫: ["水流開始活絡了。", "微溫時段，剛好泡著看。"],
  滾燙: ["這河滾燙——熱訊不停湧。", "高溫警報，小心刷到停不下來。"],
  沸騰: ["沸騰中！整條河都在吵。", "火山級熱度——請繫好安全帶。"],
};

function taipeiClock(d = new Date()): string {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export function NowRiver({
  stats,
  topItem,
}: {
  stats: ThermometerStats | null;
  topItem?: FeedItem | null;
}) {
  const [clock, setClock] = useState(() => taipeiClock());
  const [lineIdx, setLineIdx] = useState(0);

  const lines = useMemo(() => {
    const out: string[] = [];
    if (stats) {
      const pool = TEMP_LINES[stats.label] || [];
      out.push(...pool);
      out.push(`溫度 ${stats.label} ${stats.score}° · ${stats.breakdown.split(" · ")[0]}`);
    }
    if (topItem?.title) {
      out.push(`頭條：${topItem.title}`);
    }
    if (out.length === 0) out.push("河道載入中…");
    return out;
  }, [stats, topItem]);

  useEffect(() => {
    const t = setInterval(() => setClock(taipeiClock()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (lines.length <= 1) return;
    const t = setInterval(() => {
      setLineIdx((i) => (i + 1) % lines.length);
    }, 4000);
    return () => clearInterval(t);
  }, [lines.length]);

  // Reset index when lines change length
  useEffect(() => {
    setLineIdx(0);
  }, [lines]);

  const line = lines[lineIdx % lines.length] || "";

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 tabular-nums">{clock}</span>
      <span className="text-river-border" aria-hidden>
        ·
      </span>
      <span key={line} className="fade-rise min-w-0 truncate" title={line}>
        {line}
      </span>
    </span>
  );
}
