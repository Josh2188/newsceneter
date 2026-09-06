"use client";

import { useCallback, useEffect, useState } from "react";
import type { FeedItem } from "@/lib/sources/types";
import { FeedCard } from "./FeedCard";
import { FilterChips, type FilterId } from "./FilterChips";

type RiverErr = { source: string; message: string };

export function RiverFeed() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceErrors, setSourceErrors] = useState<RiverErr[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const load = useCallback(async (source: FilterId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/river?source=${source}&limit=60`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "載入失敗");
      }
      setItems(data.items || []);
      setSourceErrors(Array.isArray(data.errors) ? data.errors : []);
      setFetchedAt(data.fetchedAt || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
      setItems([]);
      setSourceErrors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  return (
    <div className="space-y-4">
      <FilterChips value={filter} onChange={setFilter} />

      {sourceErrors.length > 0 && !loading && (
        <div className="rounded-md border border-river-warn/30 bg-river-warn/10 px-3 py-2 text-[11px] text-river-warn">
          {sourceErrors.map((e) => e.message).join(" · ")}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-river-muted">
        <span>
          {loading
            ? "載入中…"
            : error
              ? "發生錯誤"
              : `共 ${items.length} 則 · 單一河道時間排序`}
        </span>
        <button
          type="button"
          onClick={() => load(filter)}
          className="rounded border border-river-border px-2 py-1 hover:border-river-accent hover:text-river-accent"
          disabled={loading}
        >
          重新整理
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg border border-river-border bg-river-panel/50"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => load(filter)}
          >
            重試
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-river-border p-8 text-center text-sm text-river-muted">
          河道目前沒有內容。試試其他來源，或稍後再整理。
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <FeedCard item={item} />
            </li>
          ))}
        </ul>
      )}

      {fetchedAt && !loading && (
        <p className="text-center text-[10px] text-river-muted/70">
          更新於{" "}
          {new Intl.DateTimeFormat("zh-TW", {
            timeZone: "Asia/Taipei",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }).format(new Date(fetchedAt))}{" "}
          （台北時間）
        </p>
      )}
    </div>
  );
}
