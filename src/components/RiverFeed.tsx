"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FeedItem } from "@/lib/sources/types";
import { clusterConfluence, detailHref } from "@/lib/confluence";
import { computeThermometer } from "@/lib/thermometer";
import { pickHeroItem, pickTickerItems } from "@/lib/rank";
import {
  clearReadIds,
  loadReadIds,
  markRead,
} from "@/lib/readIds";
import { FeedCard, ImageWallCard } from "./FeedCard";
import { FilterChips, type FilterId } from "./FilterChips";
import { RiverThermometer } from "./RiverThermometer";
import { RiverToolbar } from "./RiverToolbar";
import { HeroSpotlight } from "./HeroSpotlight";
import { HotTicker } from "./HotTicker";
import { NowRiver } from "./NowRiver";
import { CinematicDrift, useCinematicPref } from "./CinematicDrift";

type RiverErr = { source: string; message: string };

export function RiverFeed() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterId>("all");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceErrors, setSourceErrors] = useState<RiverErr[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [imageWall, setImageWall] = useState(false);
  const [diving, setDiving] = useState(false);
  const [, setCinematicPref] = useCinematicPref();
  const [driftOpen, setDriftOpen] = useState(false);

  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

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

  const thermo = useMemo(() => computeThermometer(items), [items]);
  const confluenceMap = useMemo(() => clusterConfluence(items), [items]);

  const itemsById = useMemo(() => {
    const m = new Map<string, FeedItem>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (unreadOnly) {
      list = list.filter((it) => !readIds.has(it.id));
    }
    if (imageWall) {
      list = list.filter((it) => it.images && it.images.length > 0);
    }
    return list;
  }, [items, unreadOnly, readIds, imageWall]);

  const hero = useMemo(() => {
    if (imageWall || filtered.length === 0) return null;
    return pickHeroItem(filtered, confluenceMap);
  }, [filtered, confluenceMap, imageWall]);

  const tickerItems = useMemo(
    () => pickTickerItems(items, confluenceMap, 8),
    [items, confluenceMap],
  );

  const listItems = useMemo(() => {
    if (!hero) return filtered;
    return filtered.filter((it) => it.id !== hero.id);
  }, [filtered, hero]);

  const handleOpen = useCallback((id: string) => {
    const next = markRead(id);
    setReadIds(new Set(next));
  }, []);

  const handleClearRead = useCallback(() => {
    clearReadIds();
    setReadIds(new Set());
  }, []);

  const handleRandomDive = useCallback(() => {
    if (filtered.length === 0) return;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    setDiving(true);
    handleOpen(pick.id);
    setTimeout(() => {
      router.push(detailHref(pick));
    }, 180);
    setTimeout(() => setDiving(false), 600);
  }, [filtered, handleOpen, router]);

  const openDrift = useCallback(() => {
    setDriftOpen(true);
    setCinematicPref(true);
  }, [setCinematicPref]);

  const closeDrift = useCallback(() => {
    setDriftOpen(false);
    setCinematicPref(false);
  }, [setCinematicPref]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (driftOpen) return; // CinematicDrift handles its own keys
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleRandomDive();
      } else if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        setImageWall((v) => !v);
      } else if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        openDrift();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleRandomDive, driftOpen, openDrift]);

  return (
    <div className="space-y-4">
      {!loading && !error && items.length > 0 && (
        <NowRiver stats={thermo} topItem={tickerItems[0] || items[0]} />
      )}

      <FilterChips value={filter} onChange={setFilter} />

      {!loading && !error && tickerItems.length > 0 && (
        <HotTicker items={tickerItems} onOpen={handleOpen} />
      )}

      {!loading && !error && items.length > 0 && (
        <RiverThermometer stats={thermo} />
      )}

      <RiverToolbar
        onRandomDive={handleRandomDive}
        unreadOnly={unreadOnly}
        onUnreadOnlyChange={setUnreadOnly}
        onClearRead={handleClearRead}
        imageWall={imageWall}
        onImageWallChange={setImageWall}
        diving={diving}
        cinematic={driftOpen}
        onCinematicChange={(v) => (v ? openDrift() : closeDrift())}
      />

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
              : `共 ${filtered.length} 則${
                  unreadOnly || imageWall
                    ? `（篩自 ${items.length}）`
                    : ""
                } · 單一河道時間排序`}
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
              className="h-28 animate-pulse rounded-xl border border-river-border bg-river-panel/50"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
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

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-river-border p-8 text-center text-sm text-river-muted">
          {imageWall
            ? "圖牆空空——這批河道沒有帶圖的帖，切回列表再逛逛。"
            : unreadOnly
              ? "已讀完啦，關閉「僅未讀」或清除已讀再來。"
              : "河道目前沒有內容。試試其他來源，或稍後再整理。"}
        </div>
      )}

      {!loading && !error && hero && !imageWall && (
        <HeroSpotlight
          item={hero}
          confluence={confluenceMap.get(hero.id) || null}
          isRead={readIds.has(hero.id)}
          onOpen={handleOpen}
        />
      )}

      {!loading && !error && listItems.length > 0 && !imageWall && (
        <ul className="space-y-3">
          {listItems.map((item, idx) => {
            const group = confluenceMap.get(item.id) || null;
            const siblings = group
              ? group.memberIds
                  .map((id) => itemsById.get(id))
                  .filter((x): x is FeedItem => !!x)
              : [];
            return (
              <li key={item.id}>
                <FeedCard
                  item={item}
                  confluence={group}
                  siblings={siblings}
                  isRead={readIds.has(item.id)}
                  onOpen={handleOpen}
                  featured={idx === 0 && !hero}
                  index={idx}
                />
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !error && filtered.length > 0 && imageWall && (
        <div className="columns-2 gap-3 sm:columns-3">
          {filtered.map((item, idx) => (
            <div key={item.id} className="mb-3 break-inside-avoid">
              <ImageWallCard
                item={item}
                isRead={readIds.has(item.id)}
                onOpen={handleOpen}
                index={idx}
              />
            </div>
          ))}
        </div>
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

      {driftOpen && (
        <CinematicDrift
          items={filtered.length > 0 ? filtered : items}
          onExit={closeDrift}
          onOpen={handleOpen}
        />
      )}
    </div>
  );
}
