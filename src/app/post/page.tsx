import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPostDetail, type SourceId } from "@/lib/sources";
import { formatAbsolute } from "@/lib/format";
import { SourceBadge } from "@/components/SourceBadge";
import { MarkRead } from "@/components/MarkRead";

export const dynamic = "force-dynamic";

const VALID: SourceId[] = ["ptt", "threads", "news"];

const GLOW: Record<string, string> = {
  ptt: "source-glow-ptt",
  threads: "source-glow-threads",
  news: "source-glow-news",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function emptyCommentsCopy(source: SourceId): string {
  if (source === "news") {
    return "此來源無公開回應／請至原文查看";
  }
  if (source === "threads") {
    return "目前沒有可顯示的回應（可能被封鎖或需至原文查看）";
  }
  return "目前沒有回應";
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
    <article className="fade-rise">
      <MarkRead id={post.id} />
      <Link
        href="/"
        className="mb-4 inline-flex text-xs text-river-muted hover:text-river-accent"
      >
        ← 返回河道
      </Link>

      <div
        className={`glass-panel mb-5 overflow-hidden rounded-2xl ${GLOW[post.source] || ""}`}
      >
        <div className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-river-muted">
            <SourceBadge source={post.source} />
            <span>{post.channel}</span>
            {post.isStub && (
              <span className="rounded border border-river-warn/40 bg-river-warn/10 px-1.5 py-0.5 text-river-warn">
                示範資料
              </span>
            )}
          </div>

          <h1 className="mb-3 text-xl font-bold leading-snug text-river-text sm:text-2xl">
            {post.title}
          </h1>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-river-muted">
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
        </div>
      </div>

      <div className="prose-bbs glass-panel mb-8 rounded-xl p-4 whitespace-pre-wrap">
        {post.body}
      </div>

      {post.images && post.images.length > 0 && (
        <section className="mb-8" aria-label="文章圖片">
          <h2 className="mb-3 font-mono text-sm font-semibold text-river-muted">
            圖片（{post.images.length}）
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {post.images.map((src) => (
              <a
                key={src}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-panel card-lift block overflow-hidden rounded-xl"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="max-h-[480px] w-full object-contain"
                  style={{ maxWidth: "100%" }}
                />
              </a>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-mono text-sm font-semibold text-river-muted">
          回應{comments.length > 0 ? `（${comments.length}）` : ""}
        </h2>
        {comments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-river-border/80 bg-river-panel/40 px-3 py-4 text-sm text-river-muted">
            {emptyCommentsCopy(post.source)}
            {post.url && post.url !== "#" && (
              <>
                {" "}
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-river-accent hover:underline"
                >
                  前往原文 ↗
                </a>
              </>
            )}
          </p>
        ) : (
          <ul className="space-y-2">
            {comments.map((c) => (
              <li
                key={c.id}
                className="glass-panel rounded-lg px-3 py-2 font-mono text-[12px]"
              >
                <span
                  className={
                    c.type === "push"
                      ? "text-river-ptt"
                      : c.type === "boo"
                        ? "text-red-500"
                        : "text-river-muted"
                  }
                >
                  {c.type === "push"
                    ? "推"
                    : c.type === "boo"
                      ? "噓"
                      : c.type === "arrow"
                        ? "→"
                        : c.type === "comment"
                          ? "·"
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
        )}
      </section>
    </article>
  );
}
