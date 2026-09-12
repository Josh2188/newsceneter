import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostView } from "@/components/PostView";
import type { SourceId } from "@/lib/sources/types";

const VALID: SourceId[] = ["ptt", "threads", "news"];

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const title = first(sp.title);
  const preview = first(sp.preview);
  return {
    title: title ? `${title} · 新河道` : "文章 · 新河道",
    description: preview || "新河道文章",
  };
}

export default async function PostPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const source = (first(sp.source) || "").toLowerCase() as SourceId;
  if (!VALID.includes(source)) notFound();

  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const val = first(v);
    if (val !== undefined) params[k] = val;
  }

  return <PostView params={params} />;
}
