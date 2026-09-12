import type { ReactNode } from "react";
import type { SourceId } from "@/lib/sources/types";
import {
  parsePostBlocks,
  peelUrl,
  shouldHideImageUrl,
  type BodyBlock,
} from "@/lib/postBody";

const URL_RE = /https?:\/\/[^\s<>"'[\]）】》\u3000]+/gi;

function linkify(text: string, hideImages?: string[]): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = new RegExp(URL_RE.source, "gi");
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const { url, trailing } = peelUrl(m[0]);
    const hide = hideImages && shouldHideImageUrl(url, hideImages);
    if (!hide && /^https?:\/\//i.test(url)) {
      nodes.push(
        <a
          key={`u-${k++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {url}
        </a>
      );
    }
    if (trailing) nodes.push(trailing);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function blockIsEmpty(nodes: ReactNode[]): boolean {
  return nodes.every((n) => n == null || n === "");
}

function PostImages({ images }: { images: string[] }) {
  if (!images.length) return null;
  return (
    <section className="post-images" aria-label="文章圖片">
      <h2 className="mb-3 font-mono text-sm font-semibold text-river-muted">
        圖片（{images.length}）
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {images.map((src) => (
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
  );
}

function BlockView({
  block,
  hideImages,
}: {
  block: BodyBlock;
  hideImages?: string[];
}) {
  if (block.type === "sep") return <hr />;
  const nodes = linkify(block.text, hideImages);
  if (blockIsEmpty(nodes)) return null;
  if (block.type === "note") {
    return <p className="note">{nodes}</p>;
  }
  if (block.type === "quote") {
    return <blockquote className="quote">{nodes}</blockquote>;
  }
  return <p>{nodes}</p>;
}

export function PostBody({
  body,
  source,
  images,
}: {
  body: string;
  source: SourceId;
  images?: string[];
}) {
  const gallery = images && images.length > 0 ? images : undefined;
  const blocks = parsePostBlocks(body, source, gallery);
  const proseClass = source === "ptt" ? "prose-ptt" : "prose-article";
  const afterFirst = source === "news" || source === "threads";
  const firstP = blocks.findIndex((b) => b.type === "p");

  if (!blocks.length && !gallery) return null;

  const renderBlock = (block: BodyBlock, i: number) => (
    <BlockView key={`b-${i}`} block={block} hideImages={gallery} />
  );

  return (
    <>
      <div className={`${proseClass} glass-panel mb-8 rounded-xl p-4 sm:p-5`}>
        {blocks.map((block, i) => {
          const node = renderBlock(block, i);
          if (afterFirst && gallery && i === firstP) {
            return (
              <div key={`lead-${i}`}>
                {node}
                <div className="my-5">
                  <PostImages images={gallery} />
                </div>
              </div>
            );
          }
          return node;
        })}
        {afterFirst && gallery && firstP < 0 && (
          <div className="mt-2">
            <PostImages images={gallery} />
          </div>
        )}
      </div>
      {!afterFirst && gallery ? (
        <div className="mb-8">
          <PostImages images={gallery} />
        </div>
      ) : null}
    </>
  );
}
