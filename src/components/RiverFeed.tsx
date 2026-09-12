"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { stashPendingPost } from "@/lib/pendingPost";
import { FeedCard, ImageWallCard } from "./FeedCard";
import { FilterChips, type FilterId } from "./FilterChips";
import { RiverThermometer } from "./RiverThermometer";
import { RiverToolbar } from "./RiverToolbar";
import { HeroSpotlight } from "./HeroSpotlight";
import { HotTicker } from "./HotTicker";
import { NowRiver } from "./NowRiver";
import { CinematicDrift, useCinematicPref } from "./CinematicDrift";

type RiverErr = { source: string; message: string };

const PAGE_SIZE = 40;

export function RiverFeed() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterId>("all");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceErrors, setSourceErrors] = useState<RiverErr[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);

  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [imageWall, setImageWall] = useState(false);
  const [diving, setDiving] = useState(false);
  const [, setCinematicPref] = useCinematicPref();
  const [driftOpen, setDriftOpen] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);
  const seedRef = useRef<string | null>(null);
  const nextOffsetRef = useRef(0);
  const filterRef = useRef(filter);

  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);
  useEffect(() => {
    seedRef.current = seed;
  }, [seed]);
  useEffect(() => {
    nextOffsetRef.current = nextOffset;
  }, [nextOffset]);
  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  const loadInitial = useCallback(async (source: FilterId, bust = false) => {
    setLoading(true);
    setLoadingMore(false);
    loadingMoreRef.current = false;
    setError(null);
    setItems([]);
    setSeed(null);
    seedRef.current = null;
    setNextOffset(0);
    nextOffsetRef.current = 0;
    setHasMore(false);
    hasMoreRef.current = false;
    setTotal(null);
    try {
      const qs = new URLSearchParams({
        source,
        limit: String(PAGE_SIZE),
        offset: "0",
      });
      if (bust) qs.set("_", String(Date.now()));
      const res = await fetch(`/api/river?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "載入失敗");
      }
      const pageItems: FeedItem[] = data.items || [];
      setItems(pageItems);
      const usedSeed = typeof data.seed === "string" ? data.seed : null;
      setSeed(usedSeed);
      seedRef.current = usedSeed;
      const nOff =
        typeof data.nextOffset === "number"
          ? data.nextOffset
          : pageItems.length;
      setNextOffset(nOff);
      nextOffsetRef.current = nOff;
      const more = Boolean(data.hasMore);
      setHasMore(more);
      hasMoreRef.current = more;
      setTotal(typeof data.total === "number" ? data.total : null);
      setSourceErrors(Array.isArray(data.errors) ? data.errors : []);
      setFetchedAt(data.fetchedAt || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
      setItems([]);
      setSourceErrors([]);
      setHasMore(false);
      hasMoreRef.current = false;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    const currentSeed = seedRef.current;
    if (!currentSeed) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const qs = new URLSearchParams({
        source: filterRef.current,
        limit: String(PAGE_SIZE),
        offset: String(nextOffsetRef.current),
        seed: currentSeed,
      });
      const res = await fetch(`/api/river?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "載入失敗");
      }
      const pageItems: FeedItem[] = data.items || [];
      setItems((prev) => {
        const seen = new Set(prev.map((it) => it.id));
        const appended = pageItems.filter((it) => !seen.has(it.id));
        return appended.length ? [...prev, ...appended] : prev;
      });
      const nOff =
        typeof data.nextOffset === "number"
          ? data.nextOffset
          : nextOffsetRef.current + pageItems.length;
      setNextOffset(nOff);
      nextOffsetRef.current = nOff;
      const more = Boolean(data.hasMore);
      setHasMore(more);
      hasMoreRef.current = more;
      if (typeof data.total === "number") setTotal(data.total);
      if (Array.isArray(data.errors) && data.errors.length) {
        setSourceErrors(data.errors);
      }
      if (data.fetchedAt) setFetchedAt(data.fetchedAt);
    } catch (e) {
      // Keep existing items; surface a soft error in source banner area
      setSourceErrors([
        {
          source: "all",
          message: e instanceof Error ? e.message : "載入更多失敗",
        },
      ]);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadInitial(filter);
  }, [filter, loadInitial]);

  // IntersectionObserver sentinel → append next page
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) loadMore();
      },
      { root: null, rootMargin: "400px 0px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore, loading, hasMore, items.length]);

  const thermo = useMemo(() => computeThermometer(items), [items]);
  const confluenceMap = useMemo(() => clusterConfluence(items), [items]);

  const itemsById = useMemo(() => {
    const m = new Map<string, FeedItem>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  /** First-page slice for hero / ticker so they stay stable while scrolling. */
  const firstPageItems = useMemo(
    () => items.slice(0, PAGE_SIZE),
    [items]
  );

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
    // Prefer first-page items for hero stability
    const firstFiltered = filtered.filter((it) =>
      firstPageItems.some((f) => f.id === it.id)
    );
    const pool = firstFiltered.length > 0 ? firstFiltered : filtered;
    return pickHeroItem(pool, confluenceMap);
  }, [filtered, confluenceMap, imageWall, firstPageItems]);

  const tickerItems = useMemo(
    () => pickTickerItems(firstPageItems, confluenceMap, 8),
    [firstPageItems, confluenceMap]
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
    stashPendingPost(pick);
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

  const countLabel = loading
    ? "載入中…"
    : error
      ? "發生錯誤"
      : `已載入 ${filtered.length} 則${
          unreadOnly || imageWall ? `（篩自 ${items.length}）` : ""
        }${
          total != null && !unreadOnly && !imageWall
            ? ` / 池 ${total}`
            : ""
        } · 新到舊 · 來源穿插`;

  return (
    <div className="space-y-4">
      {!loading && !error && items.length > 0 && (
        <NowRiver
          stats={thermo}
          topItem={tickerItems[0] || firstPageItems[0] || items[0]}
        />
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
        <span>{countLabel}</span>
        <button
          type="button"
          onClick={() => loadInitial(filter, true)}
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
            onClick={() => loadInitial(filter, true)}
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

      {/* Infinite-scroll sentinel */}
      {!loading && !error && items.length > 0 && (
        <div ref={sentinelRef} className="py-4 text-center text-[11px] text-river-muted">
          {loadingMore ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-river-border border-t-river-accent"
                aria-hidden
              />
              載入更多…
            </span>
          ) : hasMore ? (
            <span className="opacity-60">繼續往下滾動載入更多</span>
          ) : (
            <span>已經到底了</span>
          )}
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
