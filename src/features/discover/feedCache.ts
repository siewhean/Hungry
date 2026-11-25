import type { DiscoveryLocationFeed } from "@/lib/services/types";

/** Warm results only live in memory. The feed RPC does not vouch for offline display rights. */
export const DISCOVER_FEED_CACHE_MAX_AGE_MS = 30_000;
const MAX_ENTRIES = 8;

type Entry = {
  promise: Promise<DiscoveryLocationFeed | undefined>;
  expiresAt?: number;
};

const firstPages = new Map<string, Entry>();

export function readDiscoverFirstPage(
  key: string,
  load: () => Promise<DiscoveryLocationFeed | undefined>,
  fresh = false,
  now: () => number = Date.now,
) {
  const existing = firstPages.get(key);
  if (existing && (existing.expiresAt === undefined || (!fresh && existing.expiresAt > now()))) {
    firstPages.delete(key);
    firstPages.set(key, existing);
    return existing.promise;
  }

  const promise = Promise.resolve().then(load);
  const entry: Entry = { promise };
  firstPages.delete(key);
  firstPages.set(key, entry);
  if (firstPages.size > MAX_ENTRIES) {
    const oldest = firstPages.keys().next().value;
    if (oldest !== undefined) firstPages.delete(oldest);
  }

  void promise.then(
    (feed) => {
      if (firstPages.get(key) !== entry) return;
      if (feed && !feed.isFallback) entry.expiresAt = now() + DISCOVER_FEED_CACHE_MAX_AGE_MS;
      else firstPages.delete(key);
    },
    () => {
      if (firstPages.get(key) === entry) firstPages.delete(key);
    },
  );
  return promise;
}

export function peekDiscoverFirstPage(key: string, now = Date.now()) {
  const entry = firstPages.get(key);
  return entry?.expiresAt !== undefined && entry.expiresAt > now
    ? { promise: entry.promise, expiresAt: entry.expiresAt }
    : undefined;
}

export function discardDiscoverFirstPage(key: string) {
  firstPages.delete(key);
}

export function clearCachedDiscoverFeed() {
  firstPages.clear();
}
