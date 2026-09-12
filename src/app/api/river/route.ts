import { NextRequest, NextResponse } from "next/server";
import { fetchRiver, makeRiverSeed, type SourceId } from "@/lib/sources";

// River order is recency + source interleave; seed stabilizes pagination.
// Do not CDN-cache the response.
export const dynamic = "force-dynamic";

const VALID: (SourceId | "all")[] = [
  "all",
  "ptt",
  "threads",
  "news",
];

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 50;

export async function GET(req: NextRequest) {
  const sourceParam = (
    req.nextUrl.searchParams.get("source") || "all"
  ).toLowerCase();
  const limitParam = Number(
    req.nextUrl.searchParams.get("limit") || String(DEFAULT_LIMIT)
  );
  const offsetParam = Number(req.nextUrl.searchParams.get("offset") || "0");
  const seedParam = req.nextUrl.searchParams.get("seed");

  const source = VALID.includes(sourceParam as SourceId | "all")
    ? (sourceParam as SourceId | "all")
    : "all";
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const offset = Number.isFinite(offsetParam)
    ? Math.max(0, Math.floor(offsetParam))
    : 0;
  const seed =
    seedParam && seedParam.trim() !== "" ? seedParam.trim() : makeRiverSeed();

  try {
    const { items, errors, total, hasMore, nextOffset, seed: usedSeed } =
      await fetchRiver({ source, limit, offset, seed });
    return NextResponse.json(
      {
        ok: true,
        source,
        count: items.length,
        total,
        limit,
        offset,
        hasMore,
        nextOffset,
        seed: usedSeed,
        items,
        errors: errors.length ? errors : undefined,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (err) {
    console.error("[api/river]", err);
    return NextResponse.json(
      { ok: false, error: "無法載入河道", items: [], hasMore: false },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  }
}
