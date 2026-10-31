import type { DiscoveryLocationFeed } from "@/lib/services/types";
import { safeAsyncStorage } from "@/store/persistStorage";

/**
 * The last Home feed that loaded, kept on the phone so the next launch draws stalls and dishes at
 * once and refreshes them quietly behind. One entry: the area the diner was last in. Public
 * catalogue data only, nothing about the diner.
 */
const STORAGE_KEY = "hungry.discoverFeed.v1";
/** Older than this and the cards are no longer worth showing before the live read lands. */
export const DISCOVER_FEED_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

type CachedEntry = { feedKey: string; savedAt: number; feed: DiscoveryLocationFeed };

let memoryEntry: CachedEntry | null = null;

function isUsable(entry: CachedEntry | null, feedKey: string, now: number): entry is CachedEntry {
  return (
    entry !== null &&
    entry.feedKey === feedKey &&
    now - entry.savedAt >= 0 &&
    now - entry.savedAt <= DISCOVER_FEED_CACHE_MAX_AGE_MS &&
    Array.isArray(entry.feed?.venues) &&
    Array.isArray(entry.feed?.results) &&
    entry.feed.venues.length > 0
  );
}

/** The saved feed for this area, or null when there is none, it is too old, or it is for another area. */
export async function readCachedDiscoverFeed(
  feedKey: string,
  now: number = Date.now(),
): Promise<DiscoveryLocationFeed | null> {
  if (isUsable(memoryEntry, feedKey, now)) return memoryEntry.feed;
  try {
    const raw = await safeAsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedEntry;
    if (!isUsable(entry, feedKey, now)) return null;
    memoryEntry = entry;
    return entry.feed;
  } catch {
    // A corrupt or unreadable entry is the same as none: Home loads live.
    return null;
  }
}

/** Saves a live feed. A fallback (offline copy) or empty feed is never saved over a good one. */
export async function writeCachedDiscoverFeed(
  feedKey: string,
  feed: DiscoveryLocationFeed,
  now: number = Date.now(),
): Promise<void> {
  if (feed.isFallback || feed.venues.length === 0) return;
  const entry: CachedEntry = { feedKey, savedAt: now, feed };
  memoryEntry = entry;
  try {
    await safeAsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Best effort: a full or unavailable disk only means the next launch loads live.
  }
}

/** Forgets the saved feed (used by tests and when the data source changes). */
export async function clearCachedDiscoverFeed(): Promise<void> {
  memoryEntry = null;
  try {
    await safeAsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
