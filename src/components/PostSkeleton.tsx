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
    <article
      className="fade-rise mx-auto max-w-read"
      aria-busy="true"
      aria-label="載入文章"
    >
      <div className="mb-6 h-3 w-20 animate-pulse rounded bg-river-raised" />
      <header className="mb-8 border-b border-river-border pb-6">
        {channel ? (
          <div className="mb-3 text-[0.8125rem] text-river-muted">{channel}</div>
        ) : (
          <div className="mb-3 h-3.5 w-28 animate-pulse rounded bg-river-raised" />
        )}
        {title ? (
          <h1 className="text-[1.625rem] font-semibold leading-[1.35] tracking-[-0.015em] text-river-text sm:text-[2rem]">
            {title}
          </h1>
        ) : (
          <div className="space-y-2">
            <div className="h-7 w-full animate-pulse rounded bg-river-raised" />
            <div className="h-7 w-2/3 animate-pulse rounded bg-river-raised" />
          </div>
        )}
        {author ? (
          <div className="mt-4 text-[0.8125rem] text-river-muted">{author}</div>
        ) : (
          <div className="mt-4 h-3 w-40 animate-pulse rounded bg-river-raised" />
        )}
      </header>
      <BodySkeleton />
    </article>
  );
}

export function BodySkeleton() {
  return (
    <div className="mx-auto max-w-read" aria-hidden>
      <div className="mb-10 space-y-3.5">
        <div className="h-4 w-full animate-pulse rounded bg-river-raised" />
        <div className="h-4 w-11/12 animate-pulse rounded bg-river-raised" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-river-raised" />
        <div className="h-4 w-full animate-pulse rounded bg-river-raised" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-river-raised" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-river-raised" />
      </div>
      <div className="mb-4 h-4 w-12 animate-pulse rounded bg-river-raised" />
      <div className="space-y-3">
        <div className="h-10 animate-pulse rounded bg-river-raised" />
        <div className="h-10 animate-pulse rounded bg-river-raised" />
      </div>
    </div>
  );
}
