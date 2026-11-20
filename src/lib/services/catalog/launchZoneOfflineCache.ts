import { hungryPersistStorage } from "@/store/persistStorage";

import type {
  CatalogPage,
  CatalogPageRequest,
  CatalogPlace,
  CatalogRawDishCard,
  CatalogRawVenueCard,
} from "./index";

export const LAUNCH_ZONE_CACHE_KEY = "hungry-launch-zone-offline-v2";
/** Legacy synthetic marker stripped at read/RPC boundaries so detail RPCs never receive a non-UUID. */
export const LAUNCH_ZONE_OFFLINE_RELEASE_ID = "launch-zone-offline-v1";
/** Hard byte ceiling (~150 KB) so the cached Jurong West bundle never bloats device storage. */
export const LAUNCH_ZONE_MAX_BYTES = 150 * 1024;
/** Refresh after 7 days; offline reads within 7 days resolve in <5 ms without touching Excel/network. */
export const LAUNCH_ZONE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface TimedCatalogPage<T> {
  savedAtMs: number;
  page: CatalogPage<T>;
}

interface StoredLaunchZoneSnapshot {
  version: 2;
  placesSavedAtMs: number;
  places: CatalogPlace[];
  dishesByKey: Record<string, TimedCatalogPage<CatalogRawDishCard>>;
  venuesByKey: Record<string, TimedCatalogPage<CatalogRawVenueCard>>;
}

let memorySnapshot: StoredLaunchZoneSnapshot | null = null;
let hydratedFromStorage = false;
let hydrationPromise: Promise<StoredLaunchZoneSnapshot | null> | null = null;
let cacheGeneration = 0;
let writeQueue: Promise<void> = Promise.resolve();

function emptySnapshot(now = Date.now()): StoredLaunchZoneSnapshot {
  return {
    version: 2,
    placesSavedAtMs: now,
    places: [],
    dishesByKey: {},
    venuesByKey: {},
  };
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function isFreshTimestamp(savedAtMs: number, now = Date.now()): boolean {
  return Number.isFinite(savedAtMs) && now - savedAtMs <= LAUNCH_ZONE_MAX_AGE_MS;
}

function isValidPlaceRecord(value: unknown): value is CatalogPlace {
  if (!value || typeof value !== "object") return false;
  const place = value as Partial<CatalogPlace>;
  return Boolean(
    typeof place.id === "string" &&
    place.id.length > 0 &&
    typeof place.name === "string" &&
    place.name.length > 0,
  );
}

function isValidTimedPageMap(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  for (const entry of Object.values(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") return false;
    const timed = entry as Partial<TimedCatalogPage<unknown>>;
    if (typeof timed.savedAtMs !== "number" || !Number.isFinite(timed.savedAtMs)) return false;
    if (!timed.page || typeof timed.page !== "object") return false;
    const page = timed.page as Partial<CatalogPage<unknown>>;
    if (
      !Array.isArray(page.items) ||
      typeof page.releaseId !== "string" ||
      !page.totals ||
      typeof page.totals !== "object" ||
      typeof page.totals.venues !== "number" ||
      typeof page.totals.dishes !== "number"
    ) {
      return false;
    }
  }
  return true;
}

function isValidSnapshot(value: unknown): value is StoredLaunchZoneSnapshot {
  if (!value || typeof value !== "object") return false;
  const parsed = value as Partial<StoredLaunchZoneSnapshot>;
  return Boolean(
    parsed.version === 2 &&
    typeof parsed.placesSavedAtMs === "number" &&
    Number.isFinite(parsed.placesSavedAtMs) &&
    Array.isArray(parsed.places) &&
    parsed.places.every(isValidPlaceRecord) &&
    isValidTimedPageMap(parsed.dishesByKey) &&
    isValidTimedPageMap(parsed.venuesByKey),
  );
}

async function ensureHydrated(): Promise<StoredLaunchZoneSnapshot | null> {
  if (hydratedFromStorage) return memorySnapshot;
  if (hydrationPromise) return hydrationPromise;

  const expectedGen = cacheGeneration;
  let pending: Promise<StoredLaunchZoneSnapshot | null> | null = null;
  pending = (async () => {
    let loaded: StoredLaunchZoneSnapshot | null = null;
    try {
      const stored = await hungryPersistStorage?.getItem(LAUNCH_ZONE_CACHE_KEY);
      const candidate = stored?.state ?? null;
      if (isValidSnapshot(candidate)) {
        loaded = candidate;
      }
    } catch {
      loaded = null;
    }
    if (expectedGen === cacheGeneration) {
      memorySnapshot = loaded;
      hydratedFromStorage = true;
    }
    if (hydrationPromise === pending) {
      hydrationPromise = null;
    }
    return memorySnapshot;
  })();

  hydrationPromise = pending;
  return pending;
}

function enqueueSerializedWrite(task: (expectedGen: number) => Promise<void>): Promise<void> {
  const expectedGen = cacheGeneration;
  const nextOp = writeQueue.then(
    () => task(expectedGen),
    () => task(expectedGen),
  );
  writeQueue = nextOp.catch(() => undefined);
  return nextOp;
}

async function persistSnapshot(
  next: StoredLaunchZoneSnapshot,
  expectedGen: number,
): Promise<boolean> {
  if (expectedGen !== cacheGeneration) return false;

  let candidate = next;
  let serialized = JSON.stringify(candidate);
  if (utf8Bytes(serialized) > LAUNCH_ZONE_MAX_BYTES) {
    // Trim per-entry card lists to 20 items first so places + top dishes always fit <=150 KB.
    candidate = {
      ...next,
      dishesByKey: Object.fromEntries(
        Object.entries(next.dishesByKey).map(([key, entry]) => [
          key,
          {
            savedAtMs: entry.savedAtMs,
            page: { ...entry.page, items: entry.page.items.slice(0, 20), nextCursor: undefined },
          },
        ]),
      ),
      venuesByKey: Object.fromEntries(
        Object.entries(next.venuesByKey).map(([key, entry]) => [
          key,
          {
            savedAtMs: entry.savedAtMs,
            page: { ...entry.page, items: entry.page.items.slice(0, 20), nextCursor: undefined },
          },
        ]),
      ),
    };
    serialized = JSON.stringify(candidate);
    if (utf8Bytes(serialized) > LAUNCH_ZONE_MAX_BYTES) {
      return false;
    }
  }

  if (expectedGen !== cacheGeneration) return false;
  memorySnapshot = candidate;
  hydratedFromStorage = true;
  try {
    await Promise.resolve(
      hungryPersistStorage?.setItem(LAUNCH_ZONE_CACHE_KEY, { state: candidate, version: 2 }),
    );
    return expectedGen === cacheGeneration;
  } catch {
    return false;
  }
}

/**
 * Builds a normalized cache key for an unfiltered first-page launch-zone building browse,
 * distinguishing `sort` and `limit` variants while rejecting filtered, cursor, geo-bounded,
 * or explicit-release requests.
 */
export function buildLaunchZonePageCacheKey(
  request: CatalogPageRequest,
  knownBuildingIds: ReadonlySet<string>,
): string | null {
  if (!request.buildingId || !knownBuildingIds.has(request.buildingId)) return null;
  if (request.cursor || request.query?.trim() || request.releaseId?.trim()) return null;
  if (request.coordinate !== undefined || request.radiusMeters !== undefined) return null;
  if (request.cuisineTags?.length || request.dietaryFlags?.length || request.foodKeywords?.length) {
    return null;
  }
  if (request.buildingTypes?.length || request.maxPrice !== undefined || request.openOnly) {
    return null;
  }
  if (request.limit !== undefined && (!Number.isInteger(request.limit) || request.limit <= 0)) {
    return null;
  }
  const sortPart = request.sort ?? "default";
  const limitPart = request.limit !== undefined ? String(request.limit) : "default";
  return `${request.buildingId}|sort:${sortPart}|limit:${limitPart}`;
}

/** True only for an unfiltered first-page building browse that matches a cached launch-zone place. */
export function isCacheableLaunchZonePageRequest(
  request: CatalogPageRequest,
  knownBuildingIds: ReadonlySet<string>,
): request is CatalogPageRequest & { buildingId: string } {
  return buildLaunchZonePageCacheKey(request, knownBuildingIds) !== null;
}

function keyBelongsToKnownBuilding(key: string, validIds: ReadonlySet<string>): boolean {
  const sep = key.indexOf("|");
  const buildingId = sep >= 0 ? key.slice(0, sep) : key;
  return validIds.has(buildingId);
}

export async function rememberLaunchZonePlaces(
  places: CatalogPlace[],
  now = Date.now(),
): Promise<void> {
  if (places.length === 0) return;
  await enqueueSerializedWrite(async (expectedGen) => {
    const current = (await ensureHydrated()) ?? emptySnapshot(now);
    if (expectedGen !== cacheGeneration) return;
    const validIds = new Set(places.map((p) => p.id));
    const dishesByKey = Object.fromEntries(
      Object.entries(current.dishesByKey).filter(([key]) =>
        keyBelongsToKnownBuilding(key, validIds),
      ),
    );
    const venuesByKey = Object.fromEntries(
      Object.entries(current.venuesByKey).filter(([key]) =>
        keyBelongsToKnownBuilding(key, validIds),
      ),
    );
    await persistSnapshot(
      {
        version: 2,
        placesSavedAtMs: now,
        places,
        dishesByKey,
        venuesByKey,
      },
      expectedGen,
    );
  });
}

export async function readCachedLaunchZonePlaces(now = Date.now()): Promise<CatalogPlace[] | null> {
  const snapshot = await ensureHydrated();
  if (
    !snapshot ||
    snapshot.places.length === 0 ||
    !isFreshTimestamp(snapshot.placesSavedAtMs, now)
  ) {
    return null;
  }
  return snapshot.places;
}

export async function rememberLaunchZoneDishesPage(
  request: CatalogPageRequest,
  page: CatalogPage<CatalogRawDishCard>,
  now = Date.now(),
): Promise<void> {
  await enqueueSerializedWrite(async (expectedGen) => {
    const snapshot = await ensureHydrated();
    if (expectedGen !== cacheGeneration || !snapshot || snapshot.places.length === 0) return;
    const knownIds = new Set(snapshot.places.map((p) => p.id));
    const key = buildLaunchZonePageCacheKey(request, knownIds);
    if (!key) return;
    await persistSnapshot(
      {
        ...snapshot,
        dishesByKey: {
          ...snapshot.dishesByKey,
          [key]: {
            savedAtMs: now,
            page: {
              ...page,
              nextCursor: undefined,
              // Live catalog releases expire 24h after retirement while this cache lives 7 days;
              // omit the release ID so detail RPCs resolve the current active release instead of
              // failing on an expired UUID or a synthetic non-UUID marker.
              releaseId: "",
            },
          },
        },
      },
      expectedGen,
    );
  });
}

export async function readCachedLaunchZoneDishesPage(
  request: CatalogPageRequest,
  now = Date.now(),
): Promise<CatalogPage<CatalogRawDishCard> | null> {
  const snapshot = await ensureHydrated();
  if (!snapshot || snapshot.places.length === 0) return null;
  const knownIds = new Set(snapshot.places.map((p) => p.id));
  const key = buildLaunchZonePageCacheKey(request, knownIds);
  if (!key) return null;
  const entry = snapshot.dishesByKey[key];
  if (!entry || !isFreshTimestamp(entry.savedAtMs, now)) return null;
  return entry.page;
}

export async function rememberLaunchZoneVenuesPage(
  request: CatalogPageRequest,
  page: CatalogPage<CatalogRawVenueCard>,
  now = Date.now(),
): Promise<void> {
  await enqueueSerializedWrite(async (expectedGen) => {
    const snapshot = await ensureHydrated();
    if (expectedGen !== cacheGeneration || !snapshot || snapshot.places.length === 0) return;
    const knownIds = new Set(snapshot.places.map((p) => p.id));
    const key = buildLaunchZonePageCacheKey(request, knownIds);
    if (!key) return;
    await persistSnapshot(
      {
        ...snapshot,
        venuesByKey: {
          ...snapshot.venuesByKey,
          [key]: {
            savedAtMs: now,
            page: {
              ...page,
              nextCursor: undefined,
              releaseId: "",
            },
          },
        },
      },
      expectedGen,
    );
  });
}

export async function readCachedLaunchZoneVenuesPage(
  request: CatalogPageRequest,
  now = Date.now(),
): Promise<CatalogPage<CatalogRawVenueCard> | null> {
  const snapshot = await ensureHydrated();
  if (!snapshot || snapshot.places.length === 0) return null;
  const knownIds = new Set(snapshot.places.map((p) => p.id));
  const key = buildLaunchZonePageCacheKey(request, knownIds);
  if (!key) return null;
  const entry = snapshot.venuesByKey[key];
  if (!entry || !isFreshTimestamp(entry.savedAtMs, now)) return null;
  return entry.page;
}

export function clearLaunchZoneOfflineCache(): void {
  cacheGeneration += 1;
  memorySnapshot = null;
  hydratedFromStorage = true;
  hydrationPromise = null;
  writeQueue = writeQueue
    .then(
      () =>
        Promise.resolve(hungryPersistStorage?.removeItem(LAUNCH_ZONE_CACHE_KEY)).then(
          () => undefined,
        ),
      () =>
        Promise.resolve(hungryPersistStorage?.removeItem(LAUNCH_ZONE_CACHE_KEY)).then(
          () => undefined,
        ),
    )
    .catch(() => undefined);
}

/** Test-only reset to simulate a cold boot before storage hydration has occurred. */
export function __resetLaunchZoneCacheMemoryForTest(): void {
  cacheGeneration += 1;
  memorySnapshot = null;
  hydratedFromStorage = false;
  hydrationPromise = null;
}
