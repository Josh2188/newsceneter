import { NextRequest, NextResponse } from "next/server";
import { fetchRiver, type SourceId } from "@/lib/sources";

// Final river order is randomized per request — do not CDN-cache the response.
export const dynamic = "force-dynamic";

const VALID: (SourceId | "all")[] = [
  "all",
  "ptt",
  "threads",
  "news",
];

export async function GET(req: NextRequest) {
  const sourceParam = (
    req.nextUrl.searchParams.get("source") || "all"
  ).toLowerCase();
  const limitParam = Number(req.nextUrl.searchParams.get("limit") || "40");
  const source = VALID.includes(sourceParam as SourceId | "all")
    ? (sourceParam as SourceId | "all")
    : "all";
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 120)
    : 40;

  try {
    const { items, errors } = await fetchRiver({ source, limit });
    return NextResponse.json(
      {
        ok: true,
        source,
        count: items.length,
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
      { ok: false, error: "無法載入河道", items: [] },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  }
}
