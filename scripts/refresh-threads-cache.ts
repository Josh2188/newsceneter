/**
 * Scrape DEFAULT_USERS from threads.com and write src/data/threads-cache.json
 * for Vercel / datacenter fallback when live scrape returns 0.
 *
 * Usage: npx tsx scripts/refresh-threads-cache.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  DEFAULT_USERS,
  scrapeUserPosts,
  type ThreadsCacheFile,
} from "../src/lib/sources/threads";

async function main() {
  const users = DEFAULT_USERS;
  console.log(`[refresh-threads-cache] scraping: ${users.join(", ")}`);

  const byId = new Map<string, ThreadsCacheFile["items"][number]>();
  const bodies: Record<string, string> = {};

  for (const user of users) {
    try {
      const { items, raw } = await scrapeUserPosts(user);
      console.log(`  @${user}: ${items.length} posts`);
      for (const item of items) {
        if (!byId.has(item.id)) byId.set(item.id, item);
      }
      for (const r of raw) {
        bodies[r.code] = r.text;
      }
    } catch (err) {
      console.error(`  @${user} failed:`, err);
    }
  }

  const items = [...byId.values()].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const payload: ThreadsCacheFile = {
    updatedAt: new Date().toISOString(),
    items,
    bodies,
  };

  const outDir = join(process.cwd(), "src/data");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "threads-cache.json");
  writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(
    `[refresh-threads-cache] wrote ${items.length} items → ${outPath}`
  );
  console.log(`[refresh-threads-cache] updatedAt=${payload.updatedAt}`);

  if (items.length === 0) {
    console.error("[refresh-threads-cache] WARNING: 0 items scraped");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
