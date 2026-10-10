"use client";

import type { ThermometerStats } from "@/lib/thermometer";

/** Compact inline river-temperature meter. */
export function RiverThermometer({ stats }: { stats: ThermometerStats }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-2"
      title={`河道溫度 · ${stats.breakdown}`}
    >
      <span>
        溫度 <span className="text-river-text">{stats.label}</span>
      </span>
      <span
        className="h-1 w-12 overflow-hidden rounded-full bg-river-border"
        role="meter"
        aria-valuenow={stats.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`河道溫度 ${stats.label}`}
      >
        <span
          className="block h-full rounded-full bg-river-accent"
          style={{ width: `${stats.score}%` }}
        />
      </span>
      <span className="tabular-nums">{stats.score}°</span>
    </span>
  );
}
