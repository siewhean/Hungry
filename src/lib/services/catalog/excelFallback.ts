import { calculateDistanceMeters } from "@/lib/geo/distance";
import {
  excelRepository,
  getExcelCatalogMetadata,
  getExcelVenueCoordinate,
  listExcelDishes,
  listExcelVenues,
} from "@/lib/services/excel/repositories";
import type {
  CatalogDiscoverSectionId,
  CatalogDiscoverSections,
  CatalogDiscoverSectionsRequest,
  CatalogMapItem,
  CatalogMapRequest,
  CatalogPage,
  CatalogPageRequest,
  CatalogRawDishCard,
  CatalogRawDishDetail,
  CatalogRawMedia,
  CatalogRawVenueCard,
  CatalogRawVenueDetail,
} from "@/lib/services/catalog";
import type { Coordinate, DietaryFlag, DishDetail } from "@/types/domain";

type ExcelVenue = ReturnType<typeof listExcelVenues>[number];
type CatalogReadService = typeof import("@/lib/services/catalog").catalogRawService;

const FALLBACK_RELEASE_ID = "excel-fallback-v1";
const allDishes = listExcelDishes();
const allVenues = listExcelVenues();
const venueById = new Map(allVenues.map((venue) => [venue.id, venue]));
const buildingById = new Map(
  excelRepository.listBuildings().map((building) => [building.id, building]),
);
const dishesByVenueId = new Map<string, DishDetail[]>();

for (const dish of allDishes) {
  const current = dishesByVenueId.get(dish.venueId) ?? [];
  current.push(dish);
  dishesByVenueId.set(dish.venueId, current);
}

function cleanImageUrl(value: string | null | undefined): string | undefined {
  const url = value?.trim();
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function dishImageUrl(dish: Pick<DishDetail, "gallery" | "imageUrl">): string | undefined {
  for (const candidate of [...(dish.gallery ?? []), dish.imageUrl]) {
    const url = cleanImageUrl(candidate);
    if (url) return url;
  }
  return undefined;
}

function coordinateForVenue(venueId: string): Coordinate | undefined {
  return getExcelVenueCoordinate(venueId);
}

function distanceForVenue(
  venueId: string,
  coordinate: CatalogPageRequest["coordinate"],
): number | undefined {
  const venueCoordinate = coordinateForVenue(venueId);
  if (!coordinate || !venueCoordinate) return undefined;
  return calculateDistanceMeters(coordinate, venueCoordinate);
}

function normalizedText(values: unknown[]): string {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .trim()
    .toLocaleLowerCase();
}

function dishSearchText(dish: DishDetail, venue: ExcelVenue | undefined): string {
  return normalizedText([
    dish.name,
    dish.description,
    dish.venueName,
    dish.foodTypeTag,
    dish.tasteTags,
    dish.dietaryFlags,
    venue?.name,
    venue?.buildingName,
    venue?.planningArea,
    venue?.address,
    venue?.cuisineTags,
    venue?.dietaryFlags,
  ]);
}

function venueSearchText(venue: ExcelVenue): string {
  return normalizedText([
    venue.name,
    venue.buildingName,
    venue.planningArea,
    venue.address,
    venue.postalCode,
    venue.cuisineTags,
    venue.dietaryFlags,
    (dishesByVenueId.get(venue.id) ?? []).map((dish) => dish.name),
  ]);
}

function matchesAllTags(haystack: string, tags: readonly string[] | undefined): boolean {
  return !tags?.length || tags.every((tag) => haystack.includes(tag.trim().toLocaleLowerCase()));
}

function representativeDish(venue: ExcelVenue): DishDetail | undefined {
  const menu = dishesByVenueId.get(venue.id) ?? [];
  return (
    menu.find((dish) => dish.id === venue.topDishId && Boolean(dishImageUrl(dish))) ??
    menu.find((dish) => Boolean(dishImageUrl(dish))) ??
    menu.find((dish) => dish.id === venue.topDishId) ??
    menu[0]
  );
}

function dishSectionTags(dish: DishDetail, venue: ExcelVenue | undefined): string[] {
  const tags = ["nearby"];
  if (dish.price > 0 && dish.price <= 8) tags.push("budget");
  if (venue?.isOpen) tags.push("late_night");
  if (dish.mustOrder || dish.rating >= 4 || dish.reviewCount >= 25) tags.push("editors_choice");
  return tags;
}

function toDishCard(
  dish: DishDetail,
  coordinate?: CatalogPageRequest["coordinate"],
): CatalogRawDishCard {
  const venue = venueById.get(dish.venueId);
  const building = buildingById.get(dish.buildingId);
  const imageUrl = dishImageUrl(dish);
  return {
    id: dish.id,
    venueId: dish.venueId,
    buildingId: dish.buildingId,
    name: dish.name || "Unnamed dish",
    venueName: dish.venueName || venue?.name || "Unknown venue",
    buildingName: venue?.buildingName ?? building?.name,
    buildingType: building?.type,
    description: dish.description,
    price: Number.isFinite(dish.price) && dish.price > 0 ? dish.price : undefined,
    priceRange: dish.priceRange || undefined,
    imageUrl,
    distanceMeters: distanceForVenue(dish.venueId, coordinate),
    rating: Number.isFinite(dish.rating) && dish.rating > 0 ? dish.rating : undefined,
    reviewCount:
      Number.isFinite(dish.reviewCount) && dish.reviewCount > 0 ? dish.reviewCount : undefined,
    cuisineTags: venue?.cuisineTags ?? [],
    dietaryFlags: dish.dietaryFlags,
    sectionTags: dishSectionTags(dish, venue),
    isOpen: venue?.isOpen,
    verificationStatus: "raw",
    menuRightsStatus: "approved",
    mediaRightsStatus: imageUrl ? "approved" : "unavailable",
  };
}

function toVenueCard(
  venue: ExcelVenue,
  coordinate?: CatalogPageRequest["coordinate"],
): CatalogRawVenueCard {
  const dish = representativeDish(venue);
  const representative = dish ? toDishCard(dish, coordinate) : undefined;
  const venueImage =
    cleanImageUrl(venue.logoUrl) ?? cleanImageUrl(venue.imageUrl) ?? representative?.imageUrl;
  const venueCoordinate = coordinateForVenue(venue.id);
  return {
    id: venue.id,
    buildingId: venue.buildingId,
    name: venue.name || "Unnamed venue",
    buildingName: venue.buildingName ?? buildingById.get(venue.buildingId)?.name,
    buildingType: buildingById.get(venue.buildingId)?.type,
    unitNumber: venue.unitNumber || undefined,
    floor: venue.floor || undefined,
    imageUrl: venueImage,
    latitude: venueCoordinate?.latitude,
    longitude: venueCoordinate?.longitude,
    distanceMeters: distanceForVenue(venue.id, coordinate),
    isOpen: venue.isOpen,
    menuCount: (dishesByVenueId.get(venue.id) ?? []).length,
    representativeDish: representative
      ? {
          id: representative.id,
          name: representative.name,
          imageUrl: representative.imageUrl,
          price: representative.price,
          verificationStatus: representative.verificationStatus,
        }
      : undefined,
    verificationStatus: "raw",
    menuRightsStatus: "approved",
    mediaRightsStatus: venueImage ? "approved" : "unavailable",
  };
}

function queryMatches(value: string, query: string | undefined): boolean {
  const normalized = query?.trim().toLocaleLowerCase();
  return !normalized || value.includes(normalized);
}

function filterDishes(request: CatalogPageRequest): CatalogRawDishCard[] {
  return allDishes
    .filter((dish) => {
      const venue = venueById.get(dish.venueId);
      const text = dishSearchText(dish, venue);
      if (!queryMatches(text, request.query)) return false;
      if (!matchesAllTags(text, request.cuisineTags)) return false;
      if (
        request.dietaryFlags?.length &&
        !request.dietaryFlags.every((flag) =>
          dish.dietaryFlags.includes(flag as DietaryFlag),
        )
      ) {
        return false;
      }
      if (request.maxPrice !== undefined && dish.price > request.maxPrice) return false;
      if (request.openOnly && venue && !venue.isOpen) return false;
      const buildingType = buildingById.get(dish.buildingId)?.type;
      if (
        request.buildingTypes?.length &&
        !request.buildingTypes.includes(String(buildingType ?? ""))
      ) {
        return false;
      }
      const distance = distanceForVenue(dish.venueId, request.coordinate);
      return !(
        request.coordinate &&
        request.radiusMeters !== undefined &&
        distance !== undefined &&
        distance > request.radiusMeters
      );
    })
    .map((dish) => toDishCard(dish, request.coordinate))
    .sort((left, right) => {
      if (request.sort === "nearby") {
        return (
          (left.distanceMeters ?? Number.MAX_SAFE_INTEGER) -
            (right.distanceMeters ?? Number.MAX_SAFE_INTEGER) ||
          Number(Boolean(right.imageUrl)) - Number(Boolean(left.imageUrl)) ||
          (right.rating ?? 0) - (left.rating ?? 0)
        );
      }
      if (request.sort === "relevance" && request.query?.trim()) {
        const query = request.query.trim().toLocaleLowerCase();
        return (
          Number(right.name.toLocaleLowerCase() === query) -
            Number(left.name.toLocaleLowerCase() === query) ||
          Number(Boolean(right.imageUrl)) - Number(Boolean(left.imageUrl)) ||
          (left.distanceMeters ?? Number.MAX_SAFE_INTEGER) -
            (right.distanceMeters ?? Number.MAX_SAFE_INTEGER)
        );
      }
      return (
        Number(Boolean(right.imageUrl)) - Number(Boolean(left.imageUrl)) ||
        (right.rating ?? 0) - (left.rating ?? 0) ||
        (right.reviewCount ?? 0) - (left.reviewCount ?? 0) ||
        (left.distanceMeters ?? Number.MAX_SAFE_INTEGER) -
          (right.distanceMeters ?? Number.MAX_SAFE_INTEGER)
      );
    });
}

function filterVenues(request: CatalogPageRequest): CatalogRawVenueCard[] {
  return allVenues
    .filter((venue) => {
      const text = venueSearchText(venue);
      if (!queryMatches(text, request.query)) return false;
      if (!matchesAllTags(text, request.cuisineTags)) return false;
      if (
        request.dietaryFlags?.length &&
        !request.dietaryFlags.every((flag) => text.includes(flag.toLocaleLowerCase()))
      ) {
        return false;
      }
      if (request.openOnly && !venue.isOpen) return false;
      const buildingType = buildingById.get(venue.buildingId)?.type;
      if (
        request.buildingTypes?.length &&
        !request.buildingTypes.includes(String(buildingType ?? ""))
      ) {
        return false;
      }
      const menu = dishesByVenueId.get(venue.id) ?? [];
      if (request.maxPrice !== undefined && !menu.some((dish) => dish.price <= request.maxPrice)) {
        return false;
      }
      const distance = distanceForVenue(venue.id, request.coordinate);
      return !(
        request.coordinate &&
        request.radiusMeters !== undefined &&
        distance !== undefined &&
        distance > request.radiusMeters
      );
    })
    .map((venue) => toVenueCard(venue, request.coordinate))
    .sort((left, right) => {
      if (request.sort === "nearby") {
        return (
          (left.distanceMeters ?? Number.MAX_SAFE_INTEGER) -
            (right.distanceMeters ?? Number.MAX_SAFE_INTEGER) ||
          Number(Boolean(right.imageUrl)) - Number(Boolean(left.imageUrl))
        );
      }
      return (
        Number(Boolean(right.imageUrl)) - Number(Boolean(left.imageUrl)) ||
        (left.distanceMeters ?? Number.MAX_SAFE_INTEGER) -
          (right.distanceMeters ?? Number.MAX_SAFE_INTEGER)
      );
    });
}

function cursorOffset(cursor: string | undefined): number {
  if (!cursor?.startsWith("excel:")) return 0;
  const parsed = Number(cursor.slice("excel:".length));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function pageFromItems<T>(
  items: T[],
  request: CatalogPageRequest,
  totals: { venues: number; dishes: number },
): CatalogPage<T> {
  const offset = cursorOffset(request.cursor);
  const limit = Math.max(1, Math.min(request.limit ?? 24, 50));
  const pageItems = items.slice(offset, offset + limit);
  const nextOffset = offset + pageItems.length;
  return {
    items: pageItems,
    nextCursor: nextOffset < items.length ? `excel:${nextOffset}` : undefined,
    releaseId: FALLBACK_RELEASE_ID,
    totals,
  };
}

function requestFromSections(request: CatalogDiscoverSectionsRequest): CatalogPageRequest {
  return {
    coordinate: request.coordinate,
    radiusMeters: request.radiusMeters,
    dietaryFlags: request.dietaryFlags,
    cuisineTags: request.cuisineTags,
    maxPrice: request.maxPrice,
    sort: "nearby",
    limit: Math.max(1, Math.min(request.limitPerSection ?? 8, 50)),
  };
}

function sectionItems(
  cards: CatalogRawDishCard[],
  sectionId: CatalogDiscoverSectionId,
  limit: number,
): CatalogRawDishCard[] {
  const filtered = cards.filter((card) => card.sectionTags.includes(sectionId));
  return (filtered.length ? filtered : cards).slice(0, limit);
}

const metadata = getExcelCatalogMetadata();
const fallbackTotals = { venues: metadata.venueCount, dishes: metadata.dishCount };

export const excelCatalogFallbackService = {
  clearCache() {
    // The generated Excel catalog is immutable for the lifetime of the bundle.
  },

  async listDishes(request: CatalogPageRequest) {
    const filtered = filterDishes(request);
    return pageFromItems(filtered, request, { venues: allVenues.length, dishes: filtered.length });
  },

  async getDiscoverSections(
    request: CatalogDiscoverSectionsRequest,
  ): Promise<CatalogDiscoverSections> {
    const baseRequest = requestFromSections(request);
    const cards = filterDishes(baseRequest);
    const limit = baseRequest.limit ?? 8;
    return {
      releaseId: FALLBACK_RELEASE_ID,
      sections: {
        nearby: sectionItems(cards, "nearby", limit),
        budget: sectionItems(cards, "budget", limit),
        late_night: sectionItems(cards, "late_night", limit),
        editors_choice: sectionItems(cards, "editors_choice", limit),
      },
    };
  },

  async listVenues(request: CatalogPageRequest) {
    const filtered = filterVenues(request);
    return pageFromItems(filtered, request, { venues: filtered.length, dishes: allDishes.length });
  },

  async getDish(id: string): Promise<CatalogRawDishDetail> {
    const dish = excelRepository.getDishById(id);
    if (!dish) throw new Error("Dish not found in the bundled Excel catalog.");
    const card = toDishCard(dish);
    const media: CatalogRawMedia[] = [...(dish.gallery ?? []), dish.imageUrl]
      .map(cleanImageUrl)
      .filter((url): url is string => Boolean(url))
      .filter((url, index, urls) => urls.indexOf(url) === index)
      .map((url, index) => ({
        url,
        rightsStatus: "approved",
        approvedForDisplay: true,
        sortOrder: index,
      }));
    return { ...card, media };
  },

  async getVenue(id: string): Promise<CatalogRawVenueDetail> {
    const venue = venueById.get(id);
    if (!venue) throw new Error("Venue not found in the bundled Excel catalog.");
    return {
      ...toVenueCard(venue),
      address: venue.address,
      postalCode: venue.postalCode,
      operatingHours: venue.operatingHours || undefined,
    };
  },

  async listVenueMenu(
    venueId: string,
    request: Omit<CatalogPageRequest, "query"> = {},
  ): Promise<CatalogPage<CatalogRawDishCard>> {
    const menu = (dishesByVenueId.get(venueId) ?? []).map((dish) =>
      toDishCard(dish, request.coordinate),
    );
    return pageFromItems(menu, request, fallbackTotals);
  },

  async getMapViewport(
    request: CatalogMapRequest,
  ): Promise<{ releaseId: string; items: CatalogMapItem[] }> {
    const items = allVenues.flatMap((venue): CatalogMapItem[] => {
      const coordinate = coordinateForVenue(venue.id);
      if (!coordinate) return [];
      if (
        coordinate.latitude < request.minLatitude ||
        coordinate.latitude > request.maxLatitude ||
        coordinate.longitude < request.minLongitude ||
        coordinate.longitude > request.maxLongitude
      ) {
        return [];
      }
      return [
        {
          kind: "venue",
          id: venue.id,
          label: venue.name,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          verificationStatus: "raw",
        },
      ];
    });
    return { releaseId: FALLBACK_RELEASE_ID, items: items.slice(0, 500) };
  },
} satisfies CatalogReadService;
