export function PostSkeleton({
  title,
  channel,
  author,
}: {
  title?: string;
  channel?: string;
  author?: string;
}) {
  return (
    <article className="fade-rise" aria-busy="true" aria-label="載入文章">
      <div className="mb-4 h-3 w-20 animate-pulse rounded bg-river-panel" />
      <div className="glass-panel mb-5 overflow-hidden rounded-2xl">
        <div className="p-4 sm:p-5">
          {channel ? (
            <div className="mb-3 text-xs text-river-muted">{channel}</div>
          ) : (
            <div className="mb-3 h-4 w-28 animate-pulse rounded bg-river-border/60" />
          )}
          {title ? (
            <h1 className="mb-3 text-xl font-bold leading-snug text-river-text sm:text-2xl">
              {title}
            </h1>
          ) : (
            <div className="mb-3 h-7 w-3/4 animate-pulse rounded bg-river-border/60" />
          )}
          {author ? (
            <div className="text-xs text-river-muted">作者 {author}</div>
          ) : (
            <div className="h-3 w-40 animate-pulse rounded bg-river-border/50" />
          )}
        </div>
      </div>
      <BodySkeleton />
    </article>
  );
}

export function BodySkeleton() {
  return (
    <>
      <div className="glass-panel mb-8 space-y-3 rounded-xl p-4 sm:p-5">
        <div className="h-4 w-full animate-pulse rounded bg-river-border/50" />
        <div className="h-4 w-11/12 animate-pulse rounded bg-river-border/50" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-river-border/40" />
        <div className="h-4 w-full animate-pulse rounded bg-river-border/40" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-river-border/30" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-river-border/30" />
      </div>
      <div className="mb-3 h-4 w-16 animate-pulse rounded bg-river-border/40" />
      <div className="space-y-2">
        <div className="h-12 animate-pulse rounded-lg bg-river-panel/60" />
        <div className="h-12 animate-pulse rounded-lg bg-river-panel/40" />
      </div>
    </>
  );
}
