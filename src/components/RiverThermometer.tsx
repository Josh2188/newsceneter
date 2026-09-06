"use client";

import type { ThermometerStats } from "@/lib/thermometer";

const LABEL_EMOJI: Record<string, string> = {
  冰涼: "🧊",
  微溫: "🌤",
  滾燙: "🔥",
  沸騰: "🌋",
};

export function RiverThermometer({ stats }: { stats: ThermometerStats }) {
  const emoji = LABEL_EMOJI[stats.label] || "";
  return (
    <div className="rounded-lg border border-river-border bg-river-panel/70 px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-river-text">
          河道溫度計{" "}
          <span className="text-river-accent">
            {emoji} {stats.label}
          </span>
        </span>
        <span className="tabular-nums text-[10px] text-river-muted">
          {stats.score}°
        </span>
      </div>
      <div
        className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-river-border"
        role="meter"
        aria-valuenow={stats.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`河道溫度 ${stats.label}`}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${stats.score}%`,
            background:
              "linear-gradient(90deg, #5eead4 0%, #fbbf24 55%, #f87171 100%)",
          }}
        />
      </div>
      <p className="truncate text-[10px] leading-relaxed text-river-muted">
        {stats.breakdown}
      </p>
    </div>
  );
}
