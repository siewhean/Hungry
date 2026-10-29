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
import { getVenueBrandKey } from "@/features/search/venueDedupe";

export type BrowseMode = "dishes" | "stalls";
export {
  BROWSE_ALL_FILTER,
  BROWSE_FILTER_IDS,
  BUDGET_FILTER,
  BUDGET_MAX_PRICE,
  CUISINE_FILTERS,
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

/** The label of the order the results are really in ("Best match" without text is "Nearest"). */
export function effectiveSortLabel(sort: BrowseSortId, hasQuery: boolean, inPlace = false): string {
  const effective = effectiveSort(sort, hasQuery, inPlace);
  return BROWSE_SORT_OPTIONS.find((option) => option.id === effective)?.label ?? "Sort";
}

/**
 * Share links stay off until https://usehungry.com/search exists and /search is registered for
 * universal and app links (SEARCH-5 follow-up); until then a shared link would 404.
 */
export const SEARCH_SHARE_LINKS_LIVE: boolean = false;

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

/** ~100 m buckets, so a GPS refresh that barely moves does not reset the list. */
export function roundCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
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
  /** Typed filters ("halal laksa under $5"): dietary flags and a price cap on top of the chips. */
  parsed?: { dietary: readonly string[]; maxPrice?: number };
  /** Food types picked from the release's most common ones; with the Noodles and Rice chips, any may match. */
  foodTypes?: readonly string[];
}

export function buildBrowseRequest(input: BrowseRequestInput): CatalogPageRequest {
  const query = input.query.trim();
  const keywords = [
    ...input.filters.flatMap((id) => FOOD_KEYWORDS[id] ?? []),
    ...(input.foodTypes ?? []),
  ];
  const dietaryFlags = new Set<string>(input.parsed?.dietary ?? []);
  if (input.filters.includes("Halal")) dietaryFlags.add("halal");
  // The Under S$6 chip and a typed cap both apply: the lower one wins.
  const caps = [
    input.filters.includes(BUDGET_FILTER) ? BUDGET_MAX_PRICE : undefined,
    input.parsed?.maxPrice,
  ].filter((cap): cap is number => cap !== undefined);
  return {
    query: query || undefined,
    coordinate: input.coordinate,
    buildingId: input.buildingId,
    radiusMeters: query || input.buildingId ? undefined : BROWSE_RADIUS_METERS,
    cursor: input.cursor,
    releaseId: input.cursor ? input.releaseId : undefined,
    limit: 24,
    sort: effectiveSort(input.sort, Boolean(query), Boolean(input.buildingId)),
    dietaryFlags: [...dietaryFlags],
    cuisineTags: input.filters
      .filter((id) => CUISINE_FILTERS.has(id))
      .map((id) => id.toLowerCase()),
    foodKeywords: keywords,
    maxPrice: caps.length ? Math.min(...caps) : undefined,
  };
}

/** "120 m" under a kilometre, "2.4 km" above. */
export function formatBrowseDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export type BrowseItem = CatalogRawDishCard | CatalogRawVenueCard;
export type StallRow = CatalogRawVenueCard & { extraOutlets: number };

/**
 * Cards merge only on a real brand signal, never on the name: the same venue id (a row repeated
 * across pages) or, once venue cards carry one, a shared logo file. The first (best-ranked) card
 * is kept, and `extraOutlets` counts the other buildings the brand appears in. Raw venue cards
 * carry no logo today, so every distinct stall keeps its own card.
 */
export function mergeStallOutlets(
  stalls: readonly (CatalogRawVenueCard & { logoUrl?: string })[],
): StallRow[] {
  const groups = new Map<string, { row: StallRow; buildings: Set<string> }>();
  const order: string[] = [];
  for (const stall of stalls) {
    const key = getVenueBrandKey({ id: stall.id, logoUrl: stall.logoUrl });
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
  const topDishRating = ratingLabel(stall.qualityRating, stall.qualityReviewCount);
  return [
    stall.name,
    stall.buildingName,
    topDishRating ? `top dish ${topDishRating}` : undefined,
    stallCardDetail(stall),
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

/**
 * The stall card's price line: the best dish for the typed query ("Signature Laksa · S$6.00"), else
 * the typical price of its mains ("Mains around S$5.00"). Drinks and sides do not count towards it.
 */
export function stallCardDetail(stall: CatalogRawVenueCard): string | undefined {
  if (stall.matchedDish) {
    const price = priceLabel(stall.matchedDish.price);
    return price ? `${stall.matchedDish.name} · ${price}` : stall.matchedDish.name;
  }
  const mains = priceLabel(stall.mainPrice);
  return mains ? `Mains around ${mains}` : undefined;
}

/** The stall card's photo: its own, else the dish that matched the query, else its top dish. */
export function stallCardImage(stall: CatalogRawVenueCard): string | undefined {
  return stall.imageUrl ?? stall.matchedDish?.imageUrl ?? stall.representativeDish?.imageUrl;
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

/**
 * The line above the grid: "12 dishes within 3 km", "24 stalls at Maxwell Food Centre",
 * "5 dishes in Singapore", or just the count for typed text.
 */
export function describeResultsSummary(input: {
  count: number;
  mode: BrowseMode;
  hasQuery: boolean;
  /** The text searched for, echoed back: "1 dish for “laksa”". */
  query?: string;
  placeName?: string;
  widened: boolean;
}): string {
  const found = describeMatchCount(input.count, input.mode);
  const count = input.hasQuery && input.query ? `${found} for “${input.query}”` : found;
  if (input.placeName !== undefined) return `${count} at ${input.placeName}`;
  if (input.hasQuery) return count;
  return `${count}${input.widened ? " in Singapore" : " within 3 km"}`;
}

/** "12 dishes", "1 stall", "100+ dishes"; the server caps the count at 100. */
export function describeMatchCount(count: number, mode: BrowseMode): string {
  const [one, many] = mode === "dishes" ? ["dish", "dishes"] : ["stall", "stalls"];
  if (count <= 0) return `No ${many}`;
  if (count >= CATALOG_MATCH_COUNT_CAP) return `${CATALOG_MATCH_COUNT_CAP}+ ${many}`;
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

/** A shareable link to this search: https://usehungry.com/search?q=&filter=&mode=&place=&sort= */
export function buildSearchShareUrl(input: {
  query: string;
  filters: readonly BrowseFilterId[];
  mode: BrowseMode;
  place?: { id: string; name: string };
  sort?: BrowseSortId;
}): string {
  const params = new URLSearchParams();
  if (input.query) params.set("q", input.query);
  if (input.filters.length) params.set("filter", input.filters.join(","));
  params.set("mode", input.mode);
  if (input.place) {
    params.set("place", input.place.id);
    params.set("placeName", input.place.name);
  }
  if (input.sort && input.sort !== "relevance") params.set("sort", input.sort);
  return `${WEB_BASE_URL}/search?${params.toString()}`;
}
