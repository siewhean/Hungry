import { getSupabaseClient } from "@/lib/services/supabase/client";

export type CatalogVerificationStatus = "raw" | "verified" | "approved";
export type CatalogSort = "nearby" | "relevance" | "quality";

export interface CatalogCoordinate {
  latitude: number;
  longitude: number;
}

export interface CatalogPageRequest {
  query?: string;
  coordinate?: CatalogCoordinate;
  radiusMeters?: number;
  cuisineTags?: string[];
  dietaryFlags?: string[];
  buildingTypes?: string[];
  maxPrice?: number;
  openOnly?: boolean;
  sort?: CatalogSort;
  cursor?: string;
  releaseId?: string;
  limit?: number;
}

export interface CatalogPage<T> {
  items: T[];
  nextCursor?: string;
  releaseId: string;
  totals: {
    venues: number;
    dishes: number;
  };
}

export interface CatalogRawMedia {
  url: string;
  sourceUrl?: string;
  rightsStatus: string;
  approvedForDisplay: boolean;
  sortOrder: number;
}

export interface CatalogRawDishCard {
  id: string;
  venueId: string;
  buildingId: string;
  name: string;
  venueName: string;
  buildingName?: string;
  buildingType?: string;
  description?: string;
  price?: number;
  priceRange?: string;
  imageUrl?: string;
  distanceMeters?: number;
  rating?: number;
  reviewCount?: number;
  cuisineTags: string[];
  dietaryFlags: string[];
  isOpen?: boolean;
  verificationStatus: CatalogVerificationStatus;
  menuRightsStatus: string;
  mediaRightsStatus: string;
  menuSourceUrl?: string;
  mediaSourceUrl?: string;
  updatedAt?: string;
}

export interface CatalogRawVenueCard {
  id: string;
  buildingId: string;
  name: string;
  buildingName?: string;
  buildingType?: string;
  unitNumber?: string;
  floor?: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
  isOpen?: boolean;
  menuCount: number;
  representativeDish?: Pick<
    CatalogRawDishCard,
    "id" | "name" | "imageUrl" | "price" | "verificationStatus"
  >;
  verificationStatus: CatalogVerificationStatus;
  menuRightsStatus: string;
  mediaRightsStatus: string;
  menuSourceUrl?: string;
  mediaSourceUrl?: string;
  updatedAt?: string;
}

export interface CatalogRawDishDetail extends CatalogRawDishCard {
  media: CatalogRawMedia[];
}

export interface CatalogRawVenueDetail extends CatalogRawVenueCard {
  address?: string;
  postalCode?: string;
  operatingHours?: string;
}

export type CatalogMapItem =
  | {
      kind: "cluster";
      id: string;
      latitude: number;
      longitude: number;
      count: number;
    }
  | {
      kind: "venue";
      id: string;
      label: string;
      latitude: number;
      longitude: number;
      verificationStatus: CatalogVerificationStatus;
    };

export interface CatalogMapRequest {
  minLatitude: number;
  minLongitude: number;
  maxLatitude: number;
  maxLongitude: number;
  zoom: number;
  releaseId?: string;
  coordinate?: CatalogCoordinate;
  radiusMeters?: number;
  buildingTypes?: string[];
  cuisineTags?: string[];
  openOnly?: boolean;
  minRating?: number;
}

export type CatalogSuggestionKind = "food_type" | "place" | "stall";

/** A Search home suggestion: a food type, a place (hawker centre or mall) or a stall name. */
export interface CatalogSuggestion {
  kind: CatalogSuggestionKind;
  label: string;
}

/** Suggestions need at least this many characters; shorter text gets popular food types. */
export const CATALOG_SUGGEST_MIN_CHARS = 2;
export const CATALOG_SUGGEST_LIMIT = 8;

type CacheEntry<T> = { expiresAt: number; value: T };
const PAGE_TTL_MS = 60_000;
const DETAIL_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 40;
const pageCache = new Map<string, CacheEntry<unknown>>();
const detailCache = new Map<string, CacheEntry<unknown>>();

export class CatalogAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogAccessError";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function verificationStatus(value: unknown): CatalogVerificationStatus {
  return value === "approved" || value === "verified" ? value : "raw";
}

function mapDishCard(value: unknown): CatalogRawDishCard {
  const row = asRecord(value);
  return {
    id: asString(row.id) ?? "",
    venueId: asString(row.venue_id) ?? "",
    buildingId: asString(row.building_id) ?? "",
    name: asString(row.name) ?? "Unnamed dish",
    venueName: asString(row.venue_name) ?? "Unknown venue",
    buildingName: asString(row.building_name),
    buildingType: asString(row.building_type),
    description: asString(row.description),
    price: asNumber(row.price),
    priceRange: asString(row.price_range),
    imageUrl: asString(row.image_url),
    distanceMeters: asNumber(row.distance_meters),
    rating: asNumber(row.rating),
    reviewCount: asNumber(row.review_count),
    cuisineTags: asStringArray(row.cuisine_tags),
    dietaryFlags: asStringArray(row.dietary_flags),
    isOpen: asBoolean(row.is_open),
    verificationStatus: verificationStatus(row.verification_status),
    menuRightsStatus: asString(row.menu_rights_status) ?? "unverified",
    mediaRightsStatus: asString(row.media_rights_status) ?? "unverified",
    menuSourceUrl: asString(row.menu_source_url),
    mediaSourceUrl: asString(row.media_source_url),
    updatedAt: asString(row.updated_at),
  };
}

function mapVenueCard(value: unknown): CatalogRawVenueCard {
  const row = asRecord(value);
  const representative = asRecord(row.representative_dish);
  return {
    id: asString(row.id) ?? "",
    buildingId: asString(row.building_id) ?? "",
    name: asString(row.name) ?? "Unnamed venue",
    buildingName: asString(row.building_name),
    buildingType: asString(row.building_type),
    unitNumber: asString(row.unit_number),
    floor: asString(row.floor),
    imageUrl: asString(row.image_url),
    latitude: asNumber(row.latitude),
    longitude: asNumber(row.longitude),
    distanceMeters: asNumber(row.distance_meters),
    isOpen: asBoolean(row.is_open),
    menuCount: asNumber(row.menu_count) ?? 0,
    representativeDish: asString(representative.id)
      ? {
          id: asString(representative.id) ?? "",
          name: asString(representative.name) ?? "Unnamed dish",
          imageUrl: asString(representative.image_url),
          price: asNumber(representative.price),
          verificationStatus: verificationStatus(representative.verification_status),
        }
      : undefined,
    verificationStatus: verificationStatus(row.verification_status),
    menuRightsStatus: asString(row.menu_rights_status) ?? "unverified",
    mediaRightsStatus: asString(row.media_rights_status) ?? "unverified",
    menuSourceUrl: asString(row.menu_source_url),
    mediaSourceUrl: asString(row.media_source_url),
    updatedAt: asString(row.updated_at),
  };
}

function mapMedia(value: unknown): CatalogRawMedia {
  const row = asRecord(value);
  return {
    url: asString(row.url) ?? "",
    sourceUrl: asString(row.source_url),
    rightsStatus: asString(row.rights_status) ?? "unverified",
    approvedForDisplay: asBoolean(row.approved_for_display) ?? false,
    sortOrder: asNumber(row.sort_order) ?? 0,
  };
}

function mapSuggestions(value: unknown): CatalogSuggestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): CatalogSuggestion[] => {
    const row = asRecord(item);
    const label = asString(row.label);
    const kind = row.kind;
    if (!label || (kind !== "food_type" && kind !== "place" && kind !== "stall")) return [];
    return [{ kind, label }];
  });
}

function normaliseRequest(request: CatalogPageRequest): Record<string, unknown> {
  return {
    p_query: request.query?.trim() || null,
    p_lat: request.coordinate?.latitude ?? null,
    p_lng: request.coordinate?.longitude ?? null,
    p_radius_meters: request.radiusMeters ?? null,
    p_cuisine_tags: request.cuisineTags ?? [],
    p_dietary_flags: request.dietaryFlags ?? [],
    p_building_types: request.buildingTypes ?? [],
    p_max_price: request.maxPrice ?? null,
    p_open_only: request.openOnly ?? false,
    p_sort: request.sort ?? "quality",
    p_cursor: request.cursor ?? null,
    p_release_id: request.releaseId ?? null,
    p_limit: Math.max(1, Math.min(request.limit ?? 24, 50)),
  };
}

export function catalogRequestKey(prefix: string, value: Record<string, unknown>): string {
  return `${prefix}:${JSON.stringify(value)}`;
}

function readCache<T>(cache: Map<string, CacheEntry<unknown>>, key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

function writeCache<T>(
  cache: Map<string, CacheEntry<unknown>>,
  key: string,
  value: T,
  ttl: number,
) {
  cache.delete(key);
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  return value;
}

// Catalog browse reads are open to guests (anon key); saving anything needs an account.
function requireCatalogClient() {
  const client = getSupabaseClient();
  if (!client)
    throw new CatalogAccessError("Catalog is unavailable because Supabase is not configured.");
  return client;
}

async function callRawRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const client = requireCatalogClient();
  const { data, error } = await client.rpc(name, args);
  if (error) throw new CatalogAccessError(error.message);
  return data as T;
}

function mapPage<T>(value: unknown, mapItem: (item: unknown) => T): CatalogPage<T> {
  const row = asRecord(value);
  const totals = asRecord(row.totals);
  return {
    items: Array.isArray(row.items) ? row.items.map(mapItem) : [],
    nextCursor: asString(row.next_cursor),
    releaseId: asString(row.release_id) ?? "",
    totals: {
      venues: asNumber(totals.venues) ?? 0,
      dishes: asNumber(totals.dishes) ?? 0,
    },
  };
}

export const catalogRawService = {
  clearCache() {
    pageCache.clear();
    detailCache.clear();
  },

  async listDishes(request: CatalogPageRequest): Promise<CatalogPage<CatalogRawDishCard>> {
    const args = normaliseRequest(request);
    const key = catalogRequestKey("dishes", args);
    const cached = readCache<CatalogPage<CatalogRawDishCard>>(pageCache, key);
    if (cached) return cached;
    const page = mapPage(await callRawRpc("catalog_raw_dishes_page", args), mapDishCard);
    return writeCache(pageCache, key, page, PAGE_TTL_MS);
  },

  async listVenues(request: CatalogPageRequest): Promise<CatalogPage<CatalogRawVenueCard>> {
    const args = normaliseRequest(request);
    const key = catalogRequestKey("venues", args);
    const cached = readCache<CatalogPage<CatalogRawVenueCard>>(pageCache, key);
    if (cached) return cached;
    const page = mapPage(await callRawRpc("catalog_raw_venues_page", args), mapVenueCard);
    return writeCache(pageCache, key, page, PAGE_TTL_MS);
  },

  /** Typeahead for Search home; under two characters it returns popular food types. */
  async suggest(prefix: string): Promise<CatalogSuggestion[]> {
    const trimmed = prefix.trim().slice(0, 64);
    const args = {
      p_prefix: trimmed.length >= CATALOG_SUGGEST_MIN_CHARS ? trimmed : null,
      p_limit: CATALOG_SUGGEST_LIMIT,
    };
    const key = catalogRequestKey("suggest", { p_prefix: args.p_prefix?.toLowerCase() ?? null });
    const cached = readCache<CatalogSuggestion[]>(pageCache, key);
    if (cached) return cached;
    const items = mapSuggestions(await callRawRpc("catalog_suggest", args));
    return writeCache(pageCache, key, items, PAGE_TTL_MS);
  },

  async getDish(id: string, releaseId?: string): Promise<CatalogRawDishDetail> {
    const key = `dish:${releaseId ?? "active"}:${id}`;
    const cached = readCache<CatalogRawDishDetail>(detailCache, key);
    if (cached) return cached;
    const row = asRecord(
      await callRawRpc("catalog_raw_dish_detail", {
        p_dish_id: id,
        p_release_id: releaseId ?? null,
      }),
    );
    const detail: CatalogRawDishDetail = {
      ...mapDishCard(row),
      media: Array.isArray(row.media) ? row.media.map(mapMedia) : [],
    };
    return writeCache(detailCache, key, detail, DETAIL_TTL_MS);
  },

  async getVenue(id: string, releaseId?: string): Promise<CatalogRawVenueDetail> {
    const key = `venue:${releaseId ?? "active"}:${id}`;
    const cached = readCache<CatalogRawVenueDetail>(detailCache, key);
    if (cached) return cached;
    const row = asRecord(
      await callRawRpc("catalog_raw_venue_detail", {
        p_venue_id: id,
        p_release_id: releaseId ?? null,
      }),
    );
    const detail: CatalogRawVenueDetail = {
      ...mapVenueCard(row),
      address: asString(row.address),
      postalCode: asString(row.postal_code),
      operatingHours: asString(row.operating_hours),
    };
    return writeCache(detailCache, key, detail, DETAIL_TTL_MS);
  },

  async listVenueMenu(
    venueId: string,
    request: Omit<CatalogPageRequest, "query"> = {},
  ): Promise<CatalogPage<CatalogRawDishCard>> {
    const args = { ...normaliseRequest(request), p_venue_id: venueId };
    const key = catalogRequestKey("venue-menu", args);
    const cached = readCache<CatalogPage<CatalogRawDishCard>>(pageCache, key);
    if (cached) return cached;
    const page = mapPage(await callRawRpc("catalog_raw_venue_menu_page", args), mapDishCard);
    return writeCache(pageCache, key, page, PAGE_TTL_MS);
  },

  async getMapViewport(
    request: CatalogMapRequest,
  ): Promise<{ releaseId: string; items: CatalogMapItem[] }> {
    const args = {
      p_min_lat: request.minLatitude,
      p_min_lng: request.minLongitude,
      p_max_lat: request.maxLatitude,
      p_max_lng: request.maxLongitude,
      p_zoom: request.zoom,
      p_release_id: request.releaseId ?? null,
      p_near_lat: request.coordinate?.latitude ?? null,
      p_near_lng: request.coordinate?.longitude ?? null,
      p_radius_meters: request.radiusMeters ?? null,
      p_building_types: request.buildingTypes ?? [],
      p_cuisine_tags: request.cuisineTags ?? [],
      p_open_only: request.openOnly ?? false,
      p_min_rating: request.minRating ?? null,
    };
    const key = catalogRequestKey("map", args);
    const cached = readCache<{ releaseId: string; items: CatalogMapItem[] }>(pageCache, key);
    if (cached) return cached;
    const row = asRecord(await callRawRpc("catalog_raw_map_view", args));
    const items = Array.isArray(row.items)
      ? row.items.flatMap((item): CatalogMapItem[] => {
          const marker = asRecord(item);
          const latitude = asNumber(marker.latitude);
          const longitude = asNumber(marker.longitude);
          if (latitude === undefined || longitude === undefined) return [];
          if (marker.kind === "cluster") {
            return [
              {
                kind: "cluster",
                id: asString(marker.id) ?? "",
                latitude,
                longitude,
                count: asNumber(marker.count) ?? 0,
              },
            ];
          }
          return [
            {
              kind: "venue",
              id: asString(marker.id) ?? "",
              label: asString(marker.label) ?? "Venue",
              latitude,
              longitude,
              verificationStatus: verificationStatus(marker.verification_status),
            },
          ];
        })
      : [];
    return writeCache(
      pageCache,
      key,
      { releaseId: asString(row.release_id) ?? "", items },
      PAGE_TTL_MS,
    );
  },
};

export type CatalogRawService = typeof catalogRawService;
