/** Fisher–Yates shuffle in place; returns the same array. */
export function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/** Copy then Fisher–Yates shuffle. */
export function shuffled<T>(arr: readonly T[]): T[] {
  return shuffleInPlace([...arr]);
}

/** Sample up to `n` items without replacement (order randomized). */
export function sampleN<T>(arr: readonly T[], n: number): T[] {
  if (n <= 0) return [];
  if (n >= arr.length) return shuffled(arr);
  const copy = [...arr];
  // Partial Fisher–Yates: only need first n
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy.slice(0, n);
}

/**
 * Randomly pick the next item from non-empty source queues so batches
 * interleave unpredictably (roughly balanced when sizes are similar).
 */
export function interleaveRandom<T>(batches: T[][]): T[] {
  const queues = batches
    .map((b) => [...b])
    .filter((q) => q.length > 0);
  const out: T[] = [];
  while (queues.length > 0) {
    const qi = Math.floor(Math.random() * queues.length);
    const q = queues[qi]!;
    out.push(q.shift()!);
    if (q.length === 0) {
      queues.splice(qi, 1);
    }
  }
  return out;
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

type Timed = { createdAt: string };

function createdAtMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : -Infinity;
}

/**
 * Interleave source batches so newer items rise overall, while preferring
 * a different source than the last emitted (PTT / Threads / news weave).
 * Each batch is sorted by createdAt desc (on a copy).
 */
export function interleaveByRecency<
  T extends { source: string; createdAt: string },
>(batches: T[][]): T[] {
  const queues = batches
    .map((b) =>
      [...b].sort((a, b) => createdAtMs(b.createdAt) - createdAtMs(a.createdAt)),
    )
    .filter((q) => q.length > 0);

  const out: T[] = [];
  let lastSource: string | null = null;

  while (queues.length > 0) {
    const preferOther = queues.some((q) => q[0]!.source !== lastSource);

    let bestQi = -1;
    let bestTime = -Infinity;
    for (let i = 0; i < queues.length; i++) {
      const q = queues[i]!;
      if (preferOther && q[0]!.source === lastSource) continue;
      const t = createdAtMs(q[0]!.createdAt);
      if (t > bestTime) {
        bestTime = t;
        bestQi = i;
      }
    }

    const q = queues[bestQi]!;
    const item = q.shift()!;
    out.push(item);
    lastSource = item.source;
    if (q.length === 0) queues.splice(bestQi, 1);
  }

  return out;
}

/**
 * Shuffle within soft recency buckets (last 24h / 3d / older) so order
 * isn't chronological but ancient posts don't dominate the head.
 */
export function softRecencyShuffle<T extends Timed>(
  items: readonly T[],
  now = Date.now()
): T[] {
  const buckets: T[][] = [[], [], []];
  for (const item of items) {
    const t = Date.parse(item.createdAt);
    const age = Number.isFinite(t) ? now - t : DAY * 10;
    if (age <= DAY) buckets[0]!.push(item);
    else if (age <= 3 * DAY) buckets[1]!.push(item);
    else buckets[2]!.push(item);
  }
  for (const b of buckets) shuffleInPlace(b);
  // Randomly interleave buckets with a soft bias toward fresher ones
  // by giving newer buckets more weight when picking.
  const queues = buckets.filter((b) => b.length > 0);
  const out: T[] = [];
  while (queues.length > 0) {
    // Weight: fresher buckets (lower original index) get higher chance
    const weights = queues.map((q) => {
      const idx = buckets.indexOf(q);
      return idx === 0 ? 4 : idx === 1 ? 2 : 1;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let pick = 0;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i]!;
      if (r <= 0) {
        pick = i;
        break;
      }
    }
    const q = queues[pick]!;
    out.push(q.shift()!);
    if (q.length === 0) queues.splice(pick, 1);
  }
  return out;
}
