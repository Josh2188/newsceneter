"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FeedItem, Post, SourceId } from "@/lib/sources/types";
import { candidatePendingIds, readPendingPost } from "@/lib/pendingPost";
import { PostArticle } from "@/components/PostArticle";
import { BodySkeleton } from "@/components/PostSkeleton";

const VALID: SourceId[] = ["ptt", "threads", "news"];

function shellFromParams(params: Record<string, string>): FeedItem | null {
  const source = (params.source || "").toLowerCase() as SourceId;
  if (!VALID.includes(source)) return null;
  const title = params.title;
  if (!title && !params.preview && !params.channel) return null;
  const id =
    source === "ptt" && params.board && params.id
      ? `ptt:${params.board}:${params.id}`
      : source === "threads" && params.id
        ? `threads:${params.id}`
        : source === "news" && params.id
          ? `news:${params.id}`
          : params.id || `${source}:pending`;
  return {
    id,
    source,
    title: title || "載入中…",
    author: params.author || source,
    channel: params.channel || source,
    createdAt: params.createdAt || "",
    preview: params.preview || "",
    url: params.url || "",
    detailParams: params,
  };
}

function toPendingPost(item: FeedItem): Post {
  return {
    ...item,
    body: item.preview || "",
    comments: [],
  };
}

export function PostView({ params }: { params: Record<string, string> }) {
  const source = (params.source || "").toLowerCase() as SourceId;

  const [post, setPost] = useState<Post | null>(() => {
    const fromQuery = shellFromParams(params);
    return fromQuery ? toPendingPost(fromQuery) : null;
  });
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = readPendingPost(...candidatePendingIds(params));
    if (stored) {
      setPost((cur) => {
        if (cur && cur.body && cur.body.length > (stored.preview || "").length) {
          return cur;
        }
        return toPendingPost(stored);
      });
    }

    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) qs.set(k, v);
    }
    let cancelled = false;
    setPending(true);
    setError(null);
    fetch(`/api/post?${qs.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok || !data.post) {
          throw new Error(data.error || "找不到文章");
        }
        setPost(data.post as Post);
        setPending(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "載入文章失敗");
        setPending(false);
      });
    return () => {
      cancelled = true;
    };
    // Identity params define the article; extra shell fields shouldn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.source, params.id, params.url, params.board, params.user]);

  if (!VALID.includes(source)) {
    return (
      <div className="py-16 text-center">
        <p className="mb-2 font-mono text-lg text-river-text">找不到內容</p>
        <Link href="/" className="text-sm text-river-accent hover:underline">
          ← 返回河道
        </Link>
      </div>
    );
  }

  if (post) {
    return (
      <>
        <PostArticle post={post} pending={pending} />
        {pending && !post.body && <BodySkeleton />}
        {error && !pending && (
          <p className="mt-3 rounded-xl border border-dashed border-river-warn/40 bg-river-warn/10 px-3 py-3 text-sm text-river-warn">
            {error}。以上為預覽，請至原文查看。
          </p>
        )}
      </>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="mb-2 font-mono text-lg text-river-text">{error}</p>
        <p className="mb-6 text-sm text-river-muted">文章可能已刪除，或參數無效。</p>
        <Link href="/" className="text-sm text-river-accent hover:underline">
          ← 返回河道
        </Link>
      </div>
    );
  }

  return (
    <article className="fade-rise" aria-busy="true">
      <Link
        href="/"
        className="mb-4 inline-flex text-xs text-river-muted hover:text-river-accent"
      >
        ← 返回河道
      </Link>
      <BodySkeleton />
    </article>
  );
}
