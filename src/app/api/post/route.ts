import { NextRequest, NextResponse } from "next/server";
import { fetchPostDetail, type SourceId } from "@/lib/sources";

export const revalidate = 120;

const VALID: SourceId[] = [
  "ptt",
  "threads",
  "news",
];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const source = (sp.get("source") || "").toLowerCase() as SourceId;
  if (!VALID.includes(source)) {
    return NextResponse.json(
      { ok: false, error: "無效的來源" },
      { status: 400 }
    );
  }

  const params: Record<string, string> = {};
  sp.forEach((v, k) => {
    params[k] = v;
  });

  try {
    const post = await fetchPostDetail(source, params);
    if (!post) {
      return NextResponse.json(
        { ok: false, error: "找不到文章" },
        {
          status: 404,
          headers: {
            "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
          },
        }
      );
    }
    return NextResponse.json(
      { ok: true, post },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    console.error("[api/post]", err);
    return NextResponse.json(
      { ok: false, error: "載入文章失敗" },
      {
        status: 500,
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
        },
      }
    );
  }
}
