import { pttSource } from "../src/lib/sources/ptt";
import { threadsSource } from "../src/lib/sources/threads";
import { newsSource } from "../src/lib/sources/news";
import { fetchRiver } from "../src/lib/sources/index";
import type { FeedItem } from "../src/lib/sources/types";

function assertNoStubs(items: FeedItem[], label: string) {
  const stubs = items.filter(
    (i) =>
      (i as { isStub?: boolean }).isStub ||
      i.id.includes("demo") ||
      i.url === "#" ||
      i.title.includes("示範") ||
      i.preview.includes("示範")
  );
  if (stubs.length) {
    console.error(`FAIL ${label}: stub-like`, stubs.map((s) => s.id));
    process.exitCode = 1;
  } else {
    console.log(`OK ${label}: no stubs (${items.length})`);
  }
}

async function main() {
  const [ptt, threads, news] = await Promise.all([
    pttSource.fetchFeed(15),
    threadsSource.fetchFeed(20),
    newsSource.fetchFeed(20),
  ]);

  console.log(
    `counts: ptt=${ptt.length} threads=${threads.length} news=${news.length}`
  );

  assertNoStubs(ptt, "ptt");
  assertNoStubs(threads, "threads");
  assertNoStubs(news, "news");

  if (threads.length === 0) {
    console.error("FAIL: threads returned 0");
    process.exitCode = 1;
  } else {
    const s = threads[0];
    console.log("threads sample:", {
      id: s.id,
      author: s.author,
      url: s.url,
      title: s.title.slice(0, 70),
    });
    if (!s.url.includes("threads.net/@")) {
      console.error("FAIL: bad threads url");
      process.exitCode = 1;
    }
  }

  if (news.length === 0) {
    console.warn("WARN: news returned 0");
  }

  const { items, errors } = await fetchRiver({ limit: 60 });
  const by: Record<string, number> = {};
  for (const it of items) {
    by[it.source] = (by[it.source] || 0) + 1;
  }
  console.log("river per-source:", by, "total=", items.length);
  if (errors?.length) console.log("river errors:", errors);
  assertNoStubs(items, "river");

  const code = threads[0]?.detailParams?.id;
  if (code) {
    const post = await threadsSource.fetchPost!({
      source: "threads",
      id: code,
      user: threads[0].author,
    });
    if (!post || post.isStub) {
      console.error("FAIL: threads fetchPost missing or stub");
      process.exitCode = 1;
    } else {
      console.log("OK threads fetchPost bodyLen=", post.body.length);
    }
  }

  console.log(process.exitCode ? "SMOKE FAILED" : "SMOKE PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
