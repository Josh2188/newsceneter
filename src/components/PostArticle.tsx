import Link from "next/link";
import type { Post, SourceId } from "@/lib/sources/types";
import { formatAbsolute } from "@/lib/format";
import { SourceBadge } from "@/components/SourceBadge";
import { MarkRead } from "@/components/MarkRead";
import { PostBody } from "@/components/PostBody";

export function emptyCommentsCopy(source: SourceId): string {
  if (source === "news") {
    return "此來源無公開回應／請至原文查看";
  }
  if (source === "threads") {
    return "目前沒有可顯示的回應（可能被封鎖或需至原文查看）";
  }
  return "目前沒有回應";
}

export function BackLink() {
  return (
    <Link
      href="/"
      className="mb-6 inline-flex items-center gap-1 text-[0.8125rem] text-river-muted transition-colors hover:text-river-text"
    >
      <span aria-hidden>←</span> 返回河道
    </Link>
  );
}

export function PostArticle({
  post,
  pending,
}: {
  post: Post;
  pending?: boolean;
}) {
  const comments = post.comments || [];
  const hasUrl = post.url && post.url !== "#";

  return (
    <article className="fade-rise mx-auto max-w-read">
      <MarkRead id={post.id} />
      <BackLink />

      <header className="mb-8 border-b border-river-border pb-6">
        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-river-muted">
          <SourceBadge source={post.source} />
          {post.channel && (
            <>
              <span aria-hidden>·</span>
              <span>{post.channel}</span>
            </>
          )}
          {post.isStub && (
            <span className="rounded bg-river-warn/10 px-1.5 py-0.5 text-[0.75rem] text-river-warn">
              示範資料
            </span>
          )}
          {pending && (
            <span className="inline-flex items-center gap-1.5 text-[0.75rem]">
              <span
                className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-river-border border-t-river-muted"
                aria-hidden
              />
              載入全文
            </span>
          )}
        </div>

        <h1 className="text-[1.625rem] font-semibold leading-[1.35] tracking-[-0.015em] text-river-text sm:text-[2rem]">
          {post.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] tabular-nums text-river-muted">
          {post.author && <span className="text-river-text/80">{post.author}</span>}
          {post.createdAt && <span>{formatAbsolute(post.createdAt)} 台北</span>}
          {post.engagement?.pushes !== undefined && (
            <span>
              推 {post.engagement.pushes}
              {post.engagement.boos !== undefined
                ? `　噓 ${post.engagement.boos}`
                : ""}
              {post.engagement.arrows !== undefined
                ? `　→ ${post.engagement.arrows}`
                : ""}
            </span>
          )}
          {hasUrl && (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-river-accent hover:underline hover:underline-offset-2"
            >
              原文 ↗
            </a>
          )}
        </div>
      </header>

      {pending && !post.body ? null : (
        <PostBody body={post.body} source={post.source} images={post.images} />
      )}

      {!pending && (
        <section className="mt-10 border-t border-river-border pt-6">
          <h2 className="mb-4 text-[0.9375rem] font-semibold text-river-text">
            回應
            {comments.length > 0 && (
              <span className="ml-1.5 font-normal tabular-nums text-river-muted">
                {comments.length}
              </span>
            )}
          </h2>
          {comments.length === 0 ? (
            <p className="rounded-lg bg-river-raised px-4 py-4 text-[0.875rem] text-river-muted">
              {emptyCommentsCopy(post.source)}
              {hasUrl && (
                <>
                  {" "}
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-river-accent hover:underline hover:underline-offset-2"
                  >
                    前往原文 ↗
                  </a>
                </>
              )}
            </p>
          ) : (
            <ul className="divide-y divide-river-border/70">
              {comments.map((c) => {
                const mark =
                  c.type === "push"
                    ? "推"
                    : c.type === "boo"
                      ? "噓"
                      : c.type === "arrow"
                        ? "→"
                        : null;
                const markCls =
                  c.type === "push"
                    ? "text-river-ptt"
                    : c.type === "boo"
                      ? "text-red-500/80"
                      : "text-river-muted";
                if (post.source === "ptt") {
                  return (
                    <li
                      key={c.id}
                      className="flex gap-2.5 py-2.5 text-[0.9375rem] leading-relaxed"
                    >
                      {mark && (
                        <span className={`w-4 shrink-0 text-[0.8125rem] font-medium leading-[1.7rem] ${markCls}`}>
                          {mark}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="mr-2 text-[0.8125rem] font-medium text-river-text/75">
                          {c.author}
                        </span>
                        <span className="whitespace-pre-wrap break-words text-river-text">
                          {c.body}
                        </span>
                      </div>
                      {c.createdAt && (
                        <span className="hidden shrink-0 pt-0.5 text-[0.75rem] tabular-nums text-river-muted/80 sm:inline">
                          {c.createdAt}
                        </span>
                      )}
                    </li>
                  );
                }
                return (
                  <li key={c.id} className="py-3.5">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem]">
                      {mark && <span className={markCls}>{mark}</span>}
                      <span className="font-medium text-river-text">{c.author}</span>
                      {c.createdAt && (
                        <span className="tabular-nums text-river-muted">{c.createdAt}</span>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-river-text/90">
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
