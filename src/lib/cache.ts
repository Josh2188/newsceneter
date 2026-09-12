import { unstable_cache } from "next/cache";

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCache<T>(key: string, value: T, ttlMs = 45_000): T {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

const SOFT_FAIL = "NC_SOFT_FAIL";

class SoftFailError<T> extends Error {
  readonly value: T;
  constructor(value: T) {
    super(SOFT_FAIL);
    this.name = "SoftFailError";
    this.value = value;
  }
}

/**
 * L1 process Map + Next.js Data Cache (survives Vercel serverless cold starts).
 * Failures are thrown inside unstable_cache so they are not persisted long-term;
 * they only live briefly in memory.
 */
export async function durableCached<T>(
  keyParts: string[],
  fn: () => Promise<T>,
  options: {
    revalidate: number;
    failRevalidate?: number;
    isFailure?: (value: T) => boolean;
  }
): Promise<T> {
  const memKey = keyParts.join(":");
  const hit = getCached<T>(memKey);
  if (hit !== null) return hit;

  const failTtl = (options.failRevalidate ?? 20) * 1000;

  const runUncached = async (): Promise<T> => {
    const value = await fn();
    const failed = options.isFailure?.(value) ?? false;
    setCache(memKey, value, failed ? failTtl : options.revalidate * 1000);
    return value;
  };

  const cachedFn = unstable_cache(
    async () => {
      const value = await fn();
      if (options.isFailure?.(value)) {
        throw new SoftFailError(value);
      }
      return value;
    },
    keyParts,
    { revalidate: options.revalidate }
  );

  try {
    const value = await cachedFn();
    setCache(memKey, value, options.revalidate * 1000);
    return value;
  } catch (err) {
    if (err instanceof Error && err.message === SOFT_FAIL) {
      const payload = (err as SoftFailError<T>).value;
      if (payload !== undefined) {
        setCache(memKey, payload, failTtl);
        return payload;
      }
      return runUncached();
    }
    throw err;
  }
}

/** Race a promise against a timeout. */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback?: () => T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      if (fallback) resolve(fallback());
      else reject(new Error(`timeout after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
