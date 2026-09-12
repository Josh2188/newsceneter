import Link from "next/link";
import type { Post, SourceId } from "@/lib/sources/types";
import { formatAbsolute } from "@/lib/format";
import { SourceBadge } from "@/components/SourceBadge";
import { MarkRead } from "@/components/MarkRead";
import { PostBody } from "@/components/PostBody";

const GLOW: Record<string, string> = {
  ptt: "source-glow-ptt",
  threads: "source-glow-threads",
  news: "source-glow-news",
};

export function emptyCommentsCopy(source: SourceId): string {
  if (source === "news") {
    return "此來源無公開回應／請至原文查看";
  }
  if (source === "threads") {
    return "目前沒有可顯示的回應（可能被封鎖或需至原文查看）";
  }
  return "目前沒有回應";
}

export function PostArticle({
  post,
  pending,
}: {
  post: Post;
  pending?: boolean;
}) {
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
            {pending && (
              <span className="rounded border border-river-accent/30 bg-river-accent/10 px-1.5 py-0.5 text-river-accent">
                載入全文…
              </span>
            )}
          </div>

          <h1 className="mb-3 text-xl font-bold leading-snug text-river-text sm:text-2xl">
            {post.title}
          </h1>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-river-muted">
            <span>作者 {post.author}</span>
            {post.createdAt && (
              <span>{formatAbsolute(post.createdAt)}（台北）</span>
            )}
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

      {pending && !post.body ? null : (
        <PostBody body={post.body} source={post.source} images={post.images} />
      )}

      {!pending && (
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
              {comments.map((c) => {
                const mark =
                  c.type === "push"
                    ? "推"
                    : c.type === "boo"
                      ? "噓"
                      : c.type === "arrow"
                        ? "→"
                        : "·";
                const markCls =
                  c.type === "push"
                    ? "text-river-ptt"
                    : c.type === "boo"
                      ? "text-red-500"
                      : "text-river-muted";
                if (post.source === "ptt") {
                  return (
                    <li
                      key={c.id}
                      className="glass-panel rounded-lg px-3 py-2 text-[13px] leading-relaxed"
                    >
                      <span className={markCls}>{mark}</span>{" "}
                      <span className="text-river-accent">{c.author}</span>
                      <span className="whitespace-pre-wrap break-words text-river-text/85">
                        : {c.body}
                      </span>
                      {c.createdAt && (
                        <span className="ml-2 text-[11px] text-river-muted/60">
                          {c.createdAt}
                        </span>
                      )}
                    </li>
                  );
                }
                return (
                  <li
                    key={c.id}
                    className="glass-panel rounded-lg px-3 py-2.5 text-[14px] leading-relaxed"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px]">
                      <span className={markCls}>{mark}</span>
                      <span className="font-medium text-river-accent">
                        {c.author}
                      </span>
                      {c.createdAt && (
                        <span className="text-river-muted/60">{c.createdAt}</span>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-river-text/90">
                      {c.body}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </article>
  );
}
