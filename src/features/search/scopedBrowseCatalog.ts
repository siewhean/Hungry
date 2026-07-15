import { buildBrowseIndex, type BrowseIndex } from "@/features/search/browseIndex";
import type { HungryService } from "@/lib/services/types";

interface ScopedBrowseRequest {
  lat: number;
  lng: number;
  radiusMeters?: number;
  limit?: number;
}

interface ScopedBrowseCacheEntry {
  cachedAt: number;
  index: BrowseIndex;
}

const SCOPED_BROWSE_CACHE_TTL_MS = 60_000;
let scopedBrowseCache = new WeakMap<HungryService, Map<string, ScopedBrowseCacheEntry>>();

function cacheKey(request: ScopedBrowseRequest): string {
  return [
    request.lat.toFixed(3),
    request.lng.toFixed(3),
    request.radiusMeters ?? 3000,
    request.limit ?? 100,
  ].join(":");
}

export function clearScopedBrowseCatalogCache(): void {
  scopedBrowseCache = new WeakMap<HungryService, Map<string, ScopedBrowseCacheEntry>>();
}

export async function loadScopedBrowseCatalog(
  service: HungryService,
  request: ScopedBrowseRequest,
): Promise<BrowseIndex> {
  const key = cacheKey(request);
  const serviceCache = scopedBrowseCache.get(service);
  const cached = serviceCache?.get(key);
  if (cached && Date.now() - cached.cachedAt < SCOPED_BROWSE_CACHE_TTL_MS) {
    return cached.index;
  }
  if (cached) serviceCache?.delete(key);

  const feed = await service.discovery.listDiscoveryFeedByLocation({
    lat: request.lat,
    lng: request.lng,
    radiusMeters: request.radiusMeters ?? 3000,
    limit: request.limit ?? 100,
  });
  if (!feed) {
    throw new Error("Nearby catalog is temporarily unavailable.");
  }

  const index = buildBrowseIndex({
    venues: feed.venues,
    dishes: feed.results.map((result) => result.dish),
    stallPosts: [],
  });

  // Empty responses can be legitimate, but must not poison later retries.
  if (index.allDishes.length > 0 || index.allVenues.length > 0) {
    const nextServiceCache = serviceCache ?? new Map<string, ScopedBrowseCacheEntry>();
    nextServiceCache.set(key, { cachedAt: Date.now(), index });
    scopedBrowseCache.set(service, nextServiceCache);
  }
  return index;
}
