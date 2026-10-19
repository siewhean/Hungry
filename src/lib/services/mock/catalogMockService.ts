import { calculateDistanceMeters } from "@/lib/geo/distance";
import {
  CatalogAccessError,
  type CatalogMapItem,
  type CatalogMapRequest,
  type CatalogPage,
  type CatalogPageRequest,
  type CatalogRawDishCard,
  type CatalogRawDishDetail,
  type CatalogRawService,
  type CatalogRawVenueCard,
  type CatalogRawVenueDetail,
} from "@/lib/services/catalog";
import type { DataRepository } from "@/lib/services/types";
import type { BuildingSummary, Coordinate, DishDetail, VenueSummary } from "@/types/domain";

/**
 * The paged catalog contract served from the local (mock or Excel) repository,
 * so Search, Browse, the map and catalog detail run the same code path in every
 * data source. Filters, sorts and cursors mirror the Supabase RPCs.
 */
const MOCK_RELEASE_ID = "local-catalog";
const STALL_OFFSET_DEGREES = 0.00007;

interface LocalVenue {
  venue: VenueSummary;
  building: BuildingSummary;
  coordinate: Coordinate;
  dishes: DishDetail[];
}

function loadCatalog(repository: DataRepository): LocalVenue[] {
  const seen = new Set<string>();
  return repository.listBuildings().flatMap((building) =>
    repository.listVenuesByBuilding(building.id).flatMap((venue, index) => {
      if (seen.has(venue.id)) return [];
      seen.add(venue.id);
      // Stalls share their building's coordinate; spread them in a small grid
      // so each one stays tappable when zoomed in.
      const coordinate = {
        latitude: building.coordinate.latitude + ((index % 7) - 3) * STALL_OFFSET_DEGREES,
        longitude:
          building.coordinate.longitude + ((Math.floor(index / 7) % 7) - 3) * STALL_OFFSET_DEGREES,
      };
      return [{ venue, building, coordinate, dishes: repository.listDishesByVenue(venue.id) }];
    }),
  );
}

function verification(venue: VenueSummary) {
  return venue.verificationStatus === "verified" ? ("verified" as const) : ("raw" as const);
}

function dishTags(dish: DishDetail): string[] {
  return [...dish.tasteTags, dish.foodTypeTag ?? ""]
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function toDishCard(
  dish: DishDetail,
  entry: LocalVenue,
  coordinate?: Coordinate,
): CatalogRawDishCard {
  return {
    id: dish.id,
    venueId: entry.venue.id,
    buildingId: entry.building.id,
    name: dish.name,
    venueName: entry.venue.name,
    buildingName: entry.building.name,
    buildingType: entry.building.type,
    description: dish.description,
    price: dish.price,
    priceRange: dish.priceRange,
    imageUrl: dish.imageUrl || undefined,
    distanceMeters: coordinate
      ? calculateDistanceMeters(coordinate, entry.coordinate)
      : dish.distanceMeters,
    rating: dish.rating,
    reviewCount: dish.reviewCount,
    cuisineTags: dishTags(dish),
    dietaryFlags: [...dish.dietaryFlags],
    isOpen: entry.venue.isOpen,
    verificationStatus: verification(entry.venue),
    menuRightsStatus: "unverified",
    mediaRightsStatus: "unverified",
    updatedAt: dish.updatedAt,
  };
}

function toVenueCard(entry: LocalVenue, coordinate?: Coordinate): CatalogRawVenueCard {
  const topDish = entry.dishes.find((dish) => dish.id === entry.venue.topDishId) ?? entry.dishes[0];
  return {
    id: entry.venue.id,
    buildingId: entry.building.id,
    name: entry.venue.name,
    buildingName: entry.building.name,
    buildingType: entry.building.type,
    unitNumber: entry.venue.unitNumber,
    floor: entry.venue.floor,
    imageUrl: entry.venue.imageUrl,
    latitude: entry.coordinate.latitude,
    longitude: entry.coordinate.longitude,
    distanceMeters: coordinate ? calculateDistanceMeters(coordinate, entry.coordinate) : undefined,
    isOpen: entry.venue.isOpen,
    menuCount: entry.dishes.length,
    representativeDish: topDish
      ? {
          id: topDish.id,
          name: topDish.name,
          imageUrl: topDish.imageUrl || undefined,
          price: topDish.price,
          verificationStatus: verification(entry.venue),
        }
      : undefined,
    verificationStatus: verification(entry.venue),
    menuRightsStatus: "unverified",
    mediaRightsStatus: "unverified",
  };
}

function matchesVenueFilters(
  entry: LocalVenue,
  request: Pick<CatalogPageRequest, "buildingTypes" | "openOnly" | "coordinate" | "radiusMeters">,
) {
  if (request.buildingTypes?.length && !request.buildingTypes.includes(entry.building.type)) {
    return false;
  }
  if (request.openOnly && !entry.venue.isOpen) return false;
  if (request.coordinate && request.radiusMeters !== undefined) {
    return calculateDistanceMeters(request.coordinate, entry.coordinate) <= request.radiusMeters;
  }
  return true;
}

function matchesDishFilters(dish: DishDetail, request: CatalogPageRequest) {
  const query = request.query?.trim().toLowerCase();
  if (
    query &&
    ![dish.name, dish.venueName, dish.description ?? "", ...dishTags(dish)].some((value) =>
      value.toLowerCase().includes(query),
    )
  ) {
    return false;
  }
  const tags = dishTags(dish);
  if (request.cuisineTags?.length && !request.cuisineTags.some((tag) => tags.includes(tag))) {
    return false;
  }
  if (
    request.dietaryFlags?.length &&
    !request.dietaryFlags.every((flag) => (dish.dietaryFlags as string[]).includes(flag))
  ) {
    return false;
  }
  return request.maxPrice === undefined || dish.price <= request.maxPrice;
}

function compareCards(
  sort: CatalogPageRequest["sort"],
  query: string,
  left: { name: string; distanceMeters?: number; rating?: number; reviewCount?: number },
  right: { name: string; distanceMeters?: number; rating?: number; reviewCount?: number },
) {
  if (sort === "nearby") {
    return (left.distanceMeters ?? Infinity) - (right.distanceMeters ?? Infinity);
  }
  if (sort === "relevance" && query) {
    const leftStarts = left.name.toLowerCase().startsWith(query) ? 0 : 1;
    const rightStarts = right.name.toLowerCase().startsWith(query) ? 0 : 1;
    if (leftStarts !== rightStarts) return leftStarts - rightStarts;
  }
  return (
    (right.rating ?? 0) - (left.rating ?? 0) || (right.reviewCount ?? 0) - (left.reviewCount ?? 0)
  );
}

function paginate<T>(
  items: T[],
  request: CatalogPageRequest,
  totals: CatalogPage<T>["totals"],
): CatalogPage<T> {
  const offset = Math.max(0, Number(request.cursor ?? 0) || 0);
  const limit = Math.max(1, Math.min(request.limit ?? 24, 50));
  const end = offset + limit;
  return {
    items: items.slice(offset, end),
    nextCursor: end < items.length ? String(end) : undefined,
    releaseId: MOCK_RELEASE_ID,
    totals,
  };
}

export function createLocalCatalogService(repository: DataRepository): CatalogRawService {
  const totals = (catalog: LocalVenue[]) => ({
    venues: catalog.length,
    dishes: catalog.reduce((count, entry) => count + entry.dishes.length, 0),
  });
  const findVenue = (catalog: LocalVenue[], id: string) => {
    const entry = catalog.find((candidate) => candidate.venue.id === id);
    if (!entry) throw new CatalogAccessError("This record was not found in the catalog.");
    return entry;
  };

  const listDishCards = (catalog: LocalVenue[], request: CatalogPageRequest) => {
    const query = request.query?.trim().toLowerCase() ?? "";
    return catalog
      .filter((entry) => matchesVenueFilters(entry, request))
      .flatMap((entry) =>
        entry.dishes
          .filter((dish) => matchesDishFilters(dish, request))
          .map((dish) => toDishCard(dish, entry, request.coordinate)),
      )
      .sort((left, right) => compareCards(request.sort, query, left, right));
  };

  return {
    clearCache() {},

    async listDishes(request) {
      const catalog = loadCatalog(repository);
      return paginate(listDishCards(catalog, request), request, totals(catalog));
    },

    async listVenues(request) {
      const catalog = loadCatalog(repository);
      const query = request.query?.trim().toLowerCase() ?? "";
      const hasDishFilters = Boolean(
        request.cuisineTags?.length || request.dietaryFlags?.length || request.maxPrice,
      );
      const cards = catalog
        .filter((entry) => matchesVenueFilters(entry, request))
        .filter((entry) => {
          if (!query && !hasDishFilters) return true;
          // A stall matches by its own name, or by any dish that passes the filters.
          const nameMatches = Boolean(query) && entry.venue.name.toLowerCase().includes(query);
          if (nameMatches && !hasDishFilters) return true;
          const dishRequest = nameMatches ? { ...request, query: undefined } : request;
          return entry.dishes.some((dish) => matchesDishFilters(dish, dishRequest));
        })
        .map((entry) => {
          const topDish = entry.dishes.find((dish) => dish.id === entry.venue.topDishId);
          return {
            card: toVenueCard(entry, request.coordinate),
            name: entry.venue.name,
            distanceMeters: request.coordinate
              ? calculateDistanceMeters(request.coordinate, entry.coordinate)
              : undefined,
            rating: topDish?.rating,
            reviewCount: topDish?.reviewCount,
          };
        })
        .sort((left, right) => compareCards(request.sort, query, left, right))
        .map(({ card }) => card);
      return paginate(cards, request, totals(catalog));
    },

    async getDish(id) {
      const catalog = loadCatalog(repository);
      const dish = repository.getDishById(id);
      const entry = dish ? findVenue(catalog, dish.venueId) : undefined;
      if (!dish || !entry)
        throw new CatalogAccessError("This record was not found in the catalog.");
      const detail: CatalogRawDishDetail = {
        ...toDishCard(dish, entry),
        media: [dish.imageUrl, ...dish.gallery].filter(Boolean).map((url, sortOrder) => ({
          url,
          rightsStatus: "unverified",
          approvedForDisplay: true,
          sortOrder,
        })),
      };
      return detail;
    },

    async getVenue(id) {
      const entry = findVenue(loadCatalog(repository), id);
      const detail: CatalogRawVenueDetail = {
        ...toVenueCard(entry),
        address: entry.venue.address,
        postalCode: entry.venue.postalCode,
        operatingHours: entry.venue.operatingHours,
      };
      return detail;
    },

    async listVenueMenu(venueId, request = {}) {
      const catalog = loadCatalog(repository);
      const entry = findVenue(catalog, venueId);
      const cards = entry.dishes
        .filter((dish) => matchesDishFilters(dish, request))
        .map((dish) => toDishCard(dish, entry, request.coordinate))
        .sort((left, right) => compareCards(request.sort, "", left, right));
      return paginate(cards, request, totals(catalog));
    },

    async getMapViewport(request: CatalogMapRequest) {
      const visible = loadCatalog(repository).filter((entry) => {
        const { latitude, longitude } = entry.coordinate;
        if (
          latitude < request.minLatitude ||
          latitude > request.maxLatitude ||
          longitude < request.minLongitude ||
          longitude > request.maxLongitude
        ) {
          return false;
        }
        if (!matchesVenueFilters(entry, request)) return false;
        if (
          request.cuisineTags?.length &&
          !entry.dishes.some((dish) =>
            request.cuisineTags?.some((tag) => dishTags(dish).includes(tag)),
          )
        ) {
          return false;
        }
        if (request.minRating !== undefined) {
          const topDish = entry.dishes.find((dish) => dish.id === entry.venue.topDishId);
          return (topDish?.rating ?? 0) >= request.minRating;
        }
        return true;
      });

      // Zoomed out, stalls in one building collapse into a single cluster.
      const byBuilding = new Map<string, LocalVenue[]>();
      visible.forEach((entry) => {
        const key = request.zoom >= 16 ? entry.venue.id : entry.building.id;
        byBuilding.set(key, [...(byBuilding.get(key) ?? []), entry]);
      });
      const items = [...byBuilding.entries()].map(([key, entries]): CatalogMapItem => {
        const [first] = entries;
        if (entries.length > 1) {
          return {
            kind: "cluster",
            id: key,
            latitude: first.building.coordinate.latitude,
            longitude: first.building.coordinate.longitude,
            count: entries.length,
          };
        }
        return {
          kind: "venue",
          id: first.venue.id,
          label: first.venue.name,
          latitude: first.coordinate.latitude,
          longitude: first.coordinate.longitude,
          verificationStatus: verification(first.venue),
        };
      });
      return { releaseId: MOCK_RELEASE_ID, items };
    },
  };
}
