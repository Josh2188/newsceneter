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
          total != null && !unreadOnly && !imageWall ? ` · 池 ${total}` : ""
        }`;

  const ready = !loading && !error;

  return (
    <div>
      {/* Sticky controls: source tabs + compact toolbar */}
      <div className="sticky top-12 z-20 -mx-4 mb-4 border-b border-river-border bg-river-bg/95 px-4 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4">
          <FilterChips value={filter} onChange={setFilter} />
          <div className="py-1.5">
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
              onRefresh={() => loadInitial(filter, true)}
              refreshing={loading}
            />
          </div>
        </div>
      </div>

      {/* Quiet status line: clock + river note, temperature */}
      {ready && items.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-4 text-[0.75rem] text-river-muted">
          <NowRiver
            stats={thermo}
            topItem={tickerItems[0] || firstPageItems[0] || items[0]}
          />
          <span className="hidden sm:inline-flex">
            <RiverThermometer stats={thermo} />
          </span>
        </div>
      )}

      {ready && tickerItems.length > 0 && !imageWall && (
        <div className="mb-6">
          <HotTicker items={tickerItems} onOpen={handleOpen} />
        </div>
      )}

      {sourceErrors.length > 0 && !loading && (
        <div className="mb-4 rounded-lg bg-river-warn/10 px-3 py-2 text-[0.75rem] text-river-warn">
          {sourceErrors.map((e) => e.message).join(" · ")}
        </div>
      )}

      {loading && (
        <div className="space-y-6 pt-2" aria-busy="true" aria-label="載入中">
          <div className="space-y-3">
            <div className="aspect-[2/1] w-full animate-pulse rounded-xl bg-river-raised" />
            <div className="h-6 w-3/4 animate-pulse rounded bg-river-raised" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 border-b border-river-border/70 pb-5">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 animate-pulse rounded bg-river-raised" />
                <div className="h-4 w-11/12 animate-pulse rounded bg-river-raised" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-river-raised" />
              </div>
              <div className="h-[4.5rem] w-[4.5rem] animate-pulse rounded-lg bg-river-raised sm:w-28" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-river-border bg-river-panel p-4 text-sm text-river-text">
          {error}
          <button
            type="button"
            className="ml-3 text-river-accent underline underline-offset-2"
            onClick={() => loadInitial(filter, true)}
          >
            重試
          </button>
        </div>
      )}

      {ready && filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-river-muted">
          {imageWall
            ? "這批河道沒有帶圖的貼文，切回列表再逛逛。"
            : unreadOnly
              ? "都讀完了。關閉「僅顯示未讀」或清除已讀再來。"
              : "河道目前沒有內容。試試其他來源，或稍後再整理。"}
        </div>
      )}

      {ready && hero && !imageWall && (
        <HeroSpotlight
          item={hero}
          confluence={confluenceMap.get(hero.id) || null}
          isRead={readIds.has(hero.id)}
          onOpen={handleOpen}
        />
      )}

      {ready && listItems.length > 0 && !imageWall && (
        <ul className="mt-2">
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

      {ready && filtered.length > 0 && imageWall && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
          {filtered.map((item, idx) => (
            <ImageWallCard
              key={item.id}
              item={item}
              isRead={readIds.has(item.id)}
              onOpen={handleOpen}
              index={idx}
            />
          ))}
        </div>
      )}

      {/* Infinite-scroll sentinel */}
      {ready && items.length > 0 && (
        <div
          ref={sentinelRef}
          className="py-6 text-center text-[0.75rem] text-river-muted"
        >
          {loadingMore ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-river-border border-t-river-muted"
                aria-hidden
              />
              載入更多…
            </span>
          ) : hasMore ? (
            <span className="opacity-70">往下捲動載入更多</span>
          ) : (
            <span>已經到底了</span>
          )}
        </div>
      )}

      {!loading && (
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[0.75rem] text-river-muted">
          <span className="tabular-nums">{countLabel}</span>
          {fetchedAt && (
            <>
              <span aria-hidden>·</span>
              <span className="tabular-nums">
                更新於{" "}
                {new Intl.DateTimeFormat("zh-TW", {
                  timeZone: "Asia/Taipei",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }).format(new Date(fetchedAt))}{" "}
                台北
              </span>
            </>
          )}
          {ready && items.length > 0 && (
            <span className="inline-flex sm:hidden">
              <span aria-hidden className="mr-2">·</span>
              <RiverThermometer stats={thermo} />
            </span>
          )}
          <span aria-hidden>·</span>
          <button
            type="button"
            onClick={() => loadInitial(filter, true)}
            className="text-river-accent hover:underline hover:underline-offset-2"
            disabled={loading}
          >
            重新整理
          </button>
        </div>
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
