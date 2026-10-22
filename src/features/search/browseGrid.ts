import { WEB_BASE_URL } from "@/constants/links";
import {
  BROWSE_ALL_FILTER,
  CUISINE_FILTERS,
  BUDGET_FILTER,
  BUDGET_MAX_PRICE,
  BROWSE_FILTER_IDS,
  isBrowseFilterId,
  parseFilterIds,
  toggleFilterId,
  type BrowseFilterId,
} from "@/features/search/browseFilters";
import {
  CATALOG_MATCH_COUNT_CAP,
  CATALOG_QUERY_MAX_CHARS,
  CATALOG_QUERY_MIN_CHARS,
  type CatalogPageRequest,
  type CatalogRawDishCard,
  type CatalogRawVenueCard,
  type CatalogSort,
} from "@/lib/services/catalog";
import { sanitizeSearchQuery } from "@/lib/security/inputSanitization";
import { getVenueChainKey } from "@/features/search/venueDedupe";
import type { VenueSummary } from "@/types/domain";

export type BrowseMode = "dishes" | "stalls";
export {
  BROWSE_ALL_FILTER,
  BROWSE_FILTER_IDS,
  BUDGET_FILTER,
  BUDGET_MAX_PRICE,
  isBrowseFilterId,
  parseFilterIds,
  toggleFilterId,
};
export type { BrowseFilterId };

// Noodles and Rice are food types, not cuisine tags (the tag vocabulary has "noodle", no
// "rice"), so they match dish food types and names by fragment instead.
const FOOD_KEYWORDS: Partial<Record<BrowseFilterId, readonly string[]>> = {
  Noodles: ["noodle", "mee", "ramen", "laksa", "bee hoon", "kway teow", "udon", "soba"],
  Rice: ["rice", "nasi", "briyani", "biryani", "donburi", "claypot"],
};

/** Browsing without text shows what is within this distance. */
export const BROWSE_RADIUS_METERS = 3_000;

export type BrowseSortId = "relevance" | "nearby" | "quality" | "price";

export const BROWSE_SORT_OPTIONS: readonly { id: BrowseSortId; label: string }[] = [
  { id: "relevance", label: "Best match" },
  { id: "nearby", label: "Nearest" },
  { id: "quality", label: "Top rated" },
  { id: "price", label: "Price: low to high" },
];

/** Without typed text there is nothing to match, so "Best match" falls back to nearest. */
export function effectiveSort(sort: BrowseSortId, hasQuery: boolean, inPlace = false): CatalogSort {
  if (sort === "relevance" && !hasQuery) return inPlace ? "quality" : "nearby";
  return sort;
}

/** Typed text as sent to the catalog: markup out, whitespace collapsed, at most 80 characters. */
export function normalizeQuery(raw: string): string {
  return sanitizeSearchQuery(raw, CATALOG_QUERY_MAX_CHARS);
}

/** One character matches most of the catalog; the RPCs return nothing for it. */
export function isTooShortQuery(query: string): boolean {
  return query.length > 0 && query.length < CATALOG_QUERY_MIN_CHARS;
}

interface BrowseRequestInput {
  query: string;
  filters: readonly BrowseFilterId[];
  sort: BrowseSortId;
  coordinate: { latitude: number; longitude: number };
  cursor?: string;
  releaseId?: string;
  /** A mall, hawker centre or food court: lists its whole building, however far away. */
  buildingId?: string;
}

export function buildBrowseRequest(input: BrowseRequestInput): CatalogPageRequest {
  const query = input.query.trim();
  const keywords = input.filters.flatMap((id) => FOOD_KEYWORDS[id] ?? []);
  return {
    query: query || undefined,
    coordinate: input.coordinate,
    buildingId: input.buildingId,
    radiusMeters: query || input.buildingId ? undefined : BROWSE_RADIUS_METERS,
    cursor: input.cursor,
    releaseId: input.cursor ? input.releaseId : undefined,
    limit: 24,
    sort: effectiveSort(input.sort, Boolean(query), Boolean(input.buildingId)),
    dietaryFlags: input.filters.includes("Halal") ? ["halal"] : [],
    cuisineTags: input.filters
      .filter((id) => CUISINE_FILTERS.has(id))
      .map((id) => id.toLowerCase()),
    foodKeywords: keywords,
    maxPrice: input.filters.includes(BUDGET_FILTER) ? BUDGET_MAX_PRICE : undefined,
  };
}

/** "120 m" under a kilometre, "2.4 km" above. */
export function formatBrowseDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export type BrowseItem = CatalogRawDishCard | CatalogRawVenueCard;
export type StallRow = CatalogRawVenueCard & { extraOutlets: number };

/**
 * Chain outlets and duplicate records of the same stall show as one card, like Discover:
 * the first (best-ranked) card is kept, and `extraOutlets` counts the other buildings the
 * brand appears in. Cards in the same building with the same brand are duplicate records
 * and are folded in without counting as outlets.
 */
export function mergeStallOutlets(stalls: readonly CatalogRawVenueCard[]): StallRow[] {
  const groups = new Map<string, { row: StallRow; buildings: Set<string> }>();
  const order: string[] = [];
  for (const stall of stalls) {
    const key = getVenueChainKey({ id: stall.id, name: stall.name } as VenueSummary);
    const group = groups.get(key);
    if (!group) {
      groups.set(key, {
        row: { ...stall, extraOutlets: 0 },
        buildings: new Set([stall.buildingId]),
      });
      order.push(key);
      continue;
    }
    if (!group.buildings.has(stall.buildingId)) {
      group.buildings.add(stall.buildingId);
      group.row.extraOutlets += 1;
    }
  }
  return order.map((key) => (groups.get(key) as { row: StallRow }).row);
}

function priceLabel(price?: number) {
  return price !== undefined ? `S$${price.toFixed(2)}` : undefined;
}

function ratingLabel(rating?: number, reviewCount?: number) {
  if (!rating || !reviewCount) return undefined;
  return `${rating.toFixed(1)} from ${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`;
}

/** "Laksa, Sungei Road Laksa, Maxwell Food Centre, S$5.00, 450 m" for screen readers. */
export function cardAccessibilityLabel(mode: BrowseMode, item: BrowseItem): string {
  const distance =
    item.distanceMeters !== undefined ? formatBrowseDistance(item.distanceMeters) : undefined;
  if (mode === "dishes") {
    const dish = item as CatalogRawDishCard;
    return [
      dish.name,
      dish.venueName,
      dish.buildingName,
      priceLabel(dish.price),
      ratingLabel(dish.rating, dish.reviewCount),
      distance,
    ]
      .filter(Boolean)
      .join(", ");
  }
  const stall = item as StallRow;
  return [
    stall.name,
    stall.buildingName,
    stall.menuCount > 0
      ? `${stall.menuCount} ${stall.menuCount === 1 ? "dish" : "dishes"}`
      : undefined,
    stall.extraOutlets
      ? `${stall.extraOutlets} more ${stall.extraOutlets === 1 ? "outlet" : "outlets"}`
      : undefined,
    distance,
  ]
    .filter(Boolean)
    .join(", ");
}

/** The card's second line: "Stall · Hawker centre" for dishes, the hawker centre for stalls. */
export function cardSubtitle(mode: BrowseMode, item: BrowseItem): string {
  if (mode === "dishes") {
    const dish = item as CatalogRawDishCard;
    return dish.buildingName ? `${dish.venueName} · ${dish.buildingName}` : dish.venueName;
  }
  const stall = item as CatalogRawVenueCard;
  return stall.buildingName ?? stall.representativeDish?.name ?? "";
}

/** The rating pill: "4.5 (120)", only when there is a rating and at least one review. */
export function ratingPillText(rating?: number, reviewCount?: number): string | undefined {
  if (!rating || !reviewCount) return undefined;
  return `${rating.toFixed(1)} (${reviewCount})`;
}

/** "12 dishes", "1 stall", "100+ dishes"; the server caps the count at 100. */
export function describeMatchCount(count: number, mode: BrowseMode): string {
  const [one, many] = mode === "dishes" ? ["dish", "dishes"] : ["stall", "stalls"];
  if (count <= 0) return `No ${many}`;
  if (count >= CATALOG_MATCH_COUNT_CAP) return `${CATALOG_MATCH_COUNT_CAP}+ ${many}`;
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

/** A shareable link to this search: https://usehungry.com/search?q=&filter=&mode= */
export function buildSearchShareUrl(input: {
  query: string;
  filters: readonly BrowseFilterId[];
  mode: BrowseMode;
}): string {
  const params = new URLSearchParams();
  if (input.query) params.set("q", input.query);
  if (input.filters.length) params.set("filter", input.filters.join(","));
  params.set("mode", input.mode);
  return `${WEB_BASE_URL}/search?${params.toString()}`;
}
