import { similarityScore } from "@/lib/ai/similarityScore";
import { runRecommendationPipeline } from "@/lib/ai/tasteEngine";
import { calculateDistanceMeters } from "@/lib/geo/distance";
import type { DecideForMeOptions, DataRepository } from "@/lib/services/types";
import { dataRepositoryMock } from "@/lib/services/mock/repositories";
import { sanitizeCatalogImageUrl } from "@/lib/services/catalog/media";
import type {
  BuildingSummary,
  Coordinate,
  DietaryFlag,
  DishDetail,
  SearchFilters,
  TasteVector,
  VenueSummary,
} from "@/types/domain";

type ExcelCatalog = {
  metadata: {
    sourceRows: number;
    buildingCount: number;
    venueCount: number;
    dishCount: number;
  };
  buildingColumns: string[];
  buildings: unknown[][];
  venueColumns: string[];
  venues: unknown[][];
  dishColumns: string[];
  dishes: unknown[][];
};

type ExcelVenue = VenueSummary & {
  coordinate: Coordinate;
  rating: number;
  reviewCount: number;
  cuisineTags: string[];
  dietaryFlags: DietaryFlag[];
};

const catalog = require("./excelCatalog.generated.json") as ExcelCatalog;

function asRecord(columns: string[], row: unknown[]): Record<string, unknown> {
  return Object.fromEntries(columns.map((column, index) => [column, row[index]]));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function sanitizeExcelImageUrl(value: unknown): string | undefined {
  return sanitizeCatalogImageUrl(asString(value), {
    rightsStatus: "approved",
    approvedForDisplay: true,
  });
}

function sanitizeExcelLogoUrl(value: unknown): string | undefined {
  const logoUrl = sanitizeExcelImageUrl(value);
  if (!logoUrl) return undefined;

  const host = new URL(logoUrl).hostname.toLowerCase();
  if (
    host.endsWith("gstatic.com") ||
    host === "logo.clearbit.com" ||
    host === "icons.duckduckgo.com"
  ) {
    return undefined;
  }

  const url = new URL(logoUrl);
  if (host === "www.google.com" && url.pathname === "/s2/favicons") {
    return undefined;
  }

  return logoUrl;
}

function asNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asTasteVector(value: unknown): TasteVector {
  if (!value || typeof value !== "object") {
    return { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };
  }
  const record = value as Record<string, unknown>;
  return {
    sweet: asNumber(record.sweet, 5),
    spicy: asNumber(record.spicy, 5),
    sour: asNumber(record.sour, 5),
    salty: asNumber(record.salty, 5),
    rich: asNumber(record.rich, 5),
    aromatic: asNumber(record.aromatic, 5),
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function hasAnyNeedle(haystack: string, needles: string[]): boolean {
  return needles.length === 0 || needles.some((needle) => haystack.includes(normalize(needle)));
}

function distanceFrom(
  source: Coordinate | undefined,
  target: Coordinate | undefined,
): number | undefined {
  if (!source || !target) return undefined;
  return calculateDistanceMeters(source, target);
}

const buildings: BuildingSummary[] = catalog.buildings.map((row) => {
  const record = asRecord(catalog.buildingColumns, row);
  return {
    id: asString(record.id),
    name: asString(record.name),
    type: asString(record.type) as BuildingSummary["type"],
    coordinate: {
      latitude: asNumber(record.latitude, 1.3521),
      longitude: asNumber(record.longitude, 103.8198),
    },
    floors: asStringArray(record.floors),
    venueCount: asNumber(record.venueCount),
    isClosedToday: asBoolean(record.isClosedToday),
    heroDishId: asString(record.heroDishId),
    planningArea: asString(record.planningArea) || undefined,
    imageUrl: sanitizeExcelImageUrl(record.imageUrl),
    logoUrl: sanitizeExcelLogoUrl(record.logoUrl),
  };
});

const venues: ExcelVenue[] = catalog.venues.map((row) => {
  const record = asRecord(catalog.venueColumns, row);
  return {
    id: asString(record.id),
    buildingId: asString(record.buildingId),
    name: asString(record.name),
    unitNumber: asString(record.unitNumber),
    floor: asString(record.floor),
    isOpen: asBoolean(record.isOpen),
    topDishId: asString(record.topDishId),
    operatingHours: asString(record.operatingHours),
    deliveryLinks: [],
    planningArea: asString(record.planningArea) || undefined,
    imageUrl: sanitizeExcelImageUrl(record.imageUrl),
    logoUrl: sanitizeExcelLogoUrl(record.logoUrl),
    buildingName: asString(record.buildingName) || undefined,
    address: asString(record.address) || undefined,
    postalCode: asString(record.postalCode) || undefined,
    coordinate: {
      latitude: asNumber(record.latitude, 1.3521),
      longitude: asNumber(record.longitude, 103.8198),
    },
    rating: asNumber(record.rating),
    reviewCount: asNumber(record.reviewCount),
    cuisineTags: asStringArray(record.cuisineTags),
    dietaryFlags: asStringArray(record.dietaryFlags) as DietaryFlag[],
  };
});

const venuesById = new Map(venues.map((venue) => [venue.id, venue]));
const buildingsById = new Map(buildings.map((building) => [building.id, building]));

const dishes: DishDetail[] = catalog.dishes.map((row) => {
  const record = asRecord(catalog.dishColumns, row);
  const venue = venuesById.get(asString(record.venueId));
  const imageUrl = sanitizeExcelImageUrl(record.imageUrl) ?? "";
  return {
    id: asString(record.id),
    venueId: asString(record.venueId),
    buildingId: asString(record.buildingId),
    venueName: venue?.name ?? "",
    unitNumber: venue?.unitNumber ?? "",
    floor: venue?.floor ?? "",
    name: asString(record.name),
    foodTypeTag: asString(record.foodTypeTag) || undefined,
    imageUrl,
    distanceMeters: 0,
    rating: venue?.rating ?? 0,
    reviewCount: venue?.reviewCount ?? 0,
    price: asNumber(record.price),
    priceRange: asString(record.priceRange),
    tasteTags: asStringArray(record.tasteTags),
    tasteVector: asTasteVector(record.tasteVector),
    dietaryFlags: asStringArray(record.dietaryFlags) as DietaryFlag[],
    gallery: imageUrl ? [imageUrl] : [],
    mustOrder: asBoolean(record.mustOrder),
    availabilityFlags: [],
    reviews: [],
  };
});

const dishesById = new Map(dishes.map((dish) => [dish.id, dish]));
const venuesByBuildingId = new Map<string, ExcelVenue[]>();
const dishesByVenueId = new Map<string, DishDetail[]>();

for (const venue of venues) {
  const list = venuesByBuildingId.get(venue.buildingId) ?? [];
  list.push(venue);
  venuesByBuildingId.set(venue.buildingId, list);
}

for (const dish of dishes) {
  const list = dishesByVenueId.get(dish.venueId) ?? [];
  list.push(dish);
  dishesByVenueId.set(dish.venueId, list);
}

function withLiveDistance(dish: DishDetail, currentLocation?: Coordinate): DishDetail {
  const building = buildingsById.get(dish.buildingId);
  const distanceMeters = distanceFrom(currentLocation, building?.coordinate) ?? dish.distanceMeters;
  return distanceMeters === dish.distanceMeters ? dish : { ...dish, distanceMeters };
}

function venueDistance(venue: ExcelVenue, currentLocation?: Coordinate): number {
  return distanceFrom(currentLocation, venue.coordinate) ?? Number.MAX_SAFE_INTEGER;
}

function searchTextForDish(dish: DishDetail, venue: ExcelVenue | undefined): string {
  return normalize(
    [
      dish.name,
      dish.venueName,
      dish.foodTypeTag,
      dish.tasteTags.join(" "),
      venue?.planningArea,
      venue?.buildingName,
      venue?.cuisineTags.join(" "),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function filterDishes(filters: SearchFilters, tasteProfile: TasteVector): DishDetail[] {
  const query = normalize(filters.query);
  const currentLocation =
    typeof filters.latitude === "number" && typeof filters.longitude === "number"
      ? { latitude: filters.latitude, longitude: filters.longitude }
      : undefined;
  const areaName = normalize(filters.areaName ?? "");
  const categoryNeedles = filters.categories.map((category) => category.split(" ")[0]);
  const cuisineNeedles = (filters.cuisineTags ?? []).map(normalize);

  const filtered = dishes.filter((dish) => {
    const venue = venuesById.get(dish.venueId);
    const text = searchTextForDish(dish, venue);
    if (query && !text.includes(query)) return false;
    if (areaName && normalize(venue?.planningArea ?? "") !== areaName) return false;
    if (!hasAnyNeedle(text, categoryNeedles)) return false;
    if (!hasAnyNeedle(text, cuisineNeedles)) return false;
    if (
      filters.foodTypeTag &&
      normalize(dish.foodTypeTag ?? "") !== normalize(filters.foodTypeTag) &&
      !text.includes(normalize(filters.foodTypeTag))
    ) {
      return false;
    }
    if (filters.maxPrice && dish.price > filters.maxPrice) return false;
    if (filters.openOnly && venue && !venue.isOpen) return false;
    if (
      filters.dietaryFlags.length > 0 &&
      !filters.dietaryFlags.every((flag) => dish.dietaryFlags.includes(flag))
    ) {
      return false;
    }
    const distanceMeters = distanceFrom(currentLocation, venue?.coordinate);
    if (distanceMeters !== undefined && distanceMeters > filters.radius) return false;
    return true;
  });

  const candidates = filtered
    .map((dish) => withLiveDistance(dish, currentLocation))
    .sort((left, right) => {
      const leftVenue = venuesById.get(left.venueId);
      const rightVenue = venuesById.get(right.venueId);
      return (
        Number(Boolean(right.imageUrl)) - Number(Boolean(left.imageUrl)) ||
        left.distanceMeters - right.distanceMeters ||
        (rightVenue?.rating ?? right.rating) - (leftVenue?.rating ?? left.rating) ||
        right.reviewCount - left.reviewCount
      );
    })
    .slice(0, 2_000);

  const ranked = runRecommendationPipeline(candidates, {
    userVector: filters.tasteValues || tasteProfile,
    dietaryFlags: filters.dietaryFlags,
    radiusMeters: filters.radius,
    neophiliaIndex: 5,
    latitude: filters.latitude,
    longitude: filters.longitude,
  });
  const rankByDishId = new Map(ranked.map((result, index) => [result.dishId, index]));

  return candidates.sort((left, right) => {
    const leftVenue = venuesById.get(left.venueId);
    const rightVenue = venuesById.get(right.venueId);
    const leftImage = left.imageUrl ? 1 : 0;
    const rightImage = right.imageUrl ? 1 : 0;
    return (
      rightImage - leftImage ||
      left.distanceMeters - right.distanceMeters ||
      (rankByDishId.get(left.id) ?? 999_999) - (rankByDishId.get(right.id) ?? 999_999) ||
      (rightVenue?.rating ?? right.rating) - (leftVenue?.rating ?? left.rating) ||
      left.price - right.price
    );
  });
}

export const excelRepository: DataRepository = {
  ...dataRepositoryMock,
  listBuildings(): BuildingSummary[] {
    return buildings;
  },
  listVenuesByBuilding(buildingId: string): VenueSummary[] {
    return venuesByBuildingId.get(buildingId) ?? [];
  },
  getVenueById(venueId: string): VenueSummary | undefined {
    return venuesById.get(venueId);
  },
  getDishById(dishId: string): DishDetail | undefined {
    return dishesById.get(dishId);
  },
  listDishesByVenue(venueId: string): DishDetail[] {
    return dishesByVenueId.get(venueId) ?? [];
  },
  listPopularNearby(): DishDetail[] {
    return [...dishes]
      .sort((left, right) => {
        const leftVenue = venuesById.get(left.venueId);
        const rightVenue = venuesById.get(right.venueId);
        return (
          Number(Boolean(right.imageUrl)) - Number(Boolean(left.imageUrl)) ||
          (rightVenue?.rating ?? right.rating) - (leftVenue?.rating ?? left.rating) ||
          right.reviewCount - left.reviewCount
        );
      })
      .slice(0, 80);
  },
  searchDishes(filters: SearchFilters, tasteProfile: TasteVector): DishDetail[] {
    return filterDishes(filters, tasteProfile);
  },
  getDecideForMe(tasteProfile: TasteVector, options: DecideForMeOptions = {}) {
    const results = filterDishes(
      {
        query: "",
        categories: [],
        dietaryFlags: options.dietaryFlags ?? [],
        tasteValues: tasteProfile,
        radius: options.radiusMeters ?? 3000,
        latitude: options.latitude,
        longitude: options.longitude,
      },
      tasteProfile,
    ).filter((dish) => !(options.excludeDishIds ?? []).includes(dish.id));

    return (
      results[0] ??
      [...dishes].sort(
        (left, right) =>
          similarityScore(right.tasteVector, tasteProfile) -
          similarityScore(left.tasteVector, tasteProfile),
      )[0]
    );
  },
};

export function getExcelCatalogMetadata() {
  return catalog.metadata;
}

export function listExcelVenues(): ExcelVenue[] {
  return venues;
}

export function listExcelDishes(): DishDetail[] {
  return dishes;
}

export function getExcelVenueCoordinate(venueId: string): Coordinate | undefined {
  return venuesById.get(venueId)?.coordinate;
}
