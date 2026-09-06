import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPostDetail, type SourceId } from "@/lib/sources";
import { formatAbsolute } from "@/lib/format";
import { SourceBadge } from "@/components/SourceBadge";

export const dynamic = "force-dynamic";

const VALID: SourceId[] = ["ptt", "threads", "news"];

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
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

  const post = await fetchPostDetail(source, params);
  if (!post) notFound();

  const comments = post.comments || [];

  return (
    <article>
      <Link
        href="/"
        className="mb-4 inline-flex text-xs text-river-muted hover:text-river-accent"
      >
        ← 返回河道
      </Link>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-river-muted">
        <SourceBadge source={post.source} />
        <span>{post.channel}</span>
        {post.isStub && (
          <span className="rounded border border-river-warn/40 bg-river-warn/10 px-1.5 py-0.5 text-river-warn">
            示範資料
          </span>
        )}
      </div>

      <h1 className="mb-3 text-xl font-bold leading-snug text-river-text">
        {post.title}
      </h1>

      <div className="mb-5 flex flex-wrap gap-x-4 gap-y-1 border-b border-river-border pb-4 text-xs text-river-muted">
        <span>作者 {post.author}</span>
        <span>{formatAbsolute(post.createdAt)}（台北）</span>
        {post.engagement?.pushes !== undefined && (
          <span>
            推 {post.engagement.pushes}
            {post.engagement.boos !== undefined
              ? ` · 噓 ${post.engagement.boos}`
              : ""}
            {post.engagement.arrows !== undefined
              ? ` · → ${post.engagement.arrows}`
              : ""}
          </span>
        )}
        {post.url && post.url !== "#" && (
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-river-accent hover:underline"
          >
            原文連結 ↗
          </a>
        )}
      </div>

      <div className="prose-bbs mb-8 rounded-lg border border-river-border bg-river-panel/60 p-4">
        {post.body}
      </div>

      {comments.length > 0 && (
        <section>
          <h2 className="mb-3 font-mono text-sm font-semibold text-river-muted">
            回應（{comments.length}）
          </h2>
          <ul className="space-y-2">
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded border border-river-border/80 bg-river-panel/40 px-3 py-2 font-mono text-[12px]"
              >
                <span
                  className={
                    c.type === "push"
                      ? "text-river-ptt"
                      : c.type === "boo"
                        ? "text-red-300"
                        : "text-river-muted"
                  }
                >
                  {c.type === "push"
                    ? "推"
                    : c.type === "boo"
                      ? "噓"
                      : c.type === "arrow"
                        ? "→"
                        : "·"}
                </span>{" "}
                <span className="text-river-accent">{c.author}</span>
                <span className="text-river-text/85">: {c.body}</span>
                {c.createdAt && (
                  <span className="ml-2 text-river-muted/60">{c.createdAt}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
