import { calculateDistanceMeters } from "@/lib/geo/distance";
import {
  CATALOG_MATCH_COUNT_CAP,
  CATALOG_PLACE_MIN_STALLS,
  CATALOG_QUERY_MIN_CHARS,
  CATALOG_SUGGEST_LIMIT,
  CATALOG_SUGGEST_MIN_CHARS,
  CatalogAccessError,
  type CatalogMapItem,
  type CatalogMapRequest,
  type CatalogPage,
  type CatalogPageRequest,
  type CatalogPlace,
  type CatalogRawDishCard,
  type CatalogRawDishDetail,
  type CatalogRawService,
  type CatalogRawVenueCard,
  type CatalogRawVenueDetail,
  type CatalogSuggestion,
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
  request: Pick<
    CatalogPageRequest,
    "buildingId" | "buildingTypes" | "openOnly" | "coordinate" | "radiusMeters"
  >,
) {
  if (request.buildingId && entry.building.id !== request.buildingId) return false;
  if (request.buildingTypes?.length && !request.buildingTypes.includes(entry.building.type)) {
    return false;
  }
  if (request.openOnly && !entry.venue.isOpen) return false;
  if (request.coordinate && request.radiusMeters !== undefined) {
    return calculateDistanceMeters(request.coordinate, entry.coordinate) <= request.radiusMeters;
  }
  return true;
}

function matchesDishFilters(dish: DishDetail, request: CatalogPageRequest, buildingName = "") {
  const query = request.query?.trim().toLowerCase();
  if (
    query &&
    ![dish.name, dish.venueName, buildingName, dish.description ?? "", ...dishTags(dish)].some(
      (value) => value.toLowerCase().includes(query),
    )
  ) {
    return false;
  }
  const tags = dishTags(dish);
  if (request.cuisineTags?.length && !request.cuisineTags.some((tag) => tags.includes(tag))) {
    return false;
  }
  if (request.foodKeywords?.length) {
    const text = `${dish.name} ${dish.foodTypeTag ?? ""}`.toLowerCase();
    if (!request.foodKeywords.some((keyword) => text.includes(keyword.trim().toLowerCase()))) {
      return false;
    }
  }
  if (
    request.dietaryFlags?.length &&
    !request.dietaryFlags.every((flag) => (dish.dietaryFlags as string[]).includes(flag))
  ) {
    return false;
  }
  return request.maxPrice === undefined || dish.price <= request.maxPrice;
}

interface SortableCard {
  name: string;
  distanceMeters?: number;
  rating?: number;
  reviewCount?: number;
  price?: number;
}

function compareCards(
  sort: CatalogPageRequest["sort"],
  query: string,
  left: SortableCard,
  right: SortableCard,
) {
  if (sort === "nearby") {
    return (left.distanceMeters ?? Infinity) - (right.distanceMeters ?? Infinity);
  }
  if (sort === "price") {
    return (left.price ?? Infinity) - (right.price ?? Infinity);
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

function countStallsPerBuilding(catalog: LocalVenue[]) {
  const counts = new Map<string, number>();
  for (const entry of catalog) {
    counts.set(entry.building.id, (counts.get(entry.building.id) ?? 0) + 1);
  }
  return counts;
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
    matchCount: Math.min(items.length, CATALOG_MATCH_COUNT_CAP),
    totals,
  };
}

/** Like the RPCs, text under the minimum length searches nothing. */
function isTooShortQuery(request: CatalogPageRequest) {
  const query = request.query?.trim() ?? "";
  return query.length > 0 && query.length < CATALOG_QUERY_MIN_CHARS;
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
          .filter((dish) => matchesDishFilters(dish, request, entry.building.name))
          .map((dish) => toDishCard(dish, entry, request.coordinate)),
      )
      .sort((left, right) => compareCards(request.sort, query, left, right));
  };

  return {
    clearCache() {},

    async listDishes(request) {
      const catalog = loadCatalog(repository);
      if (isTooShortQuery(request)) return paginate([], request, totals(catalog));
      return paginate(listDishCards(catalog, request), request, totals(catalog));
    },

    async listVenues(request) {
      const catalog = loadCatalog(repository);
      if (isTooShortQuery(request)) return paginate([], request, totals(catalog));
      const query = request.query?.trim().toLowerCase() ?? "";
      const hasDishFilters = Boolean(
        request.cuisineTags?.length ||
        request.dietaryFlags?.length ||
        request.foodKeywords?.length ||
        request.maxPrice,
      );
      const cards = catalog
        .filter((entry) => matchesVenueFilters(entry, request))
        .filter((entry) => {
          if (!query && !hasDishFilters) return true;
          // A stall matches by its own or its building's name, or by any dish that passes the filters.
          const nameMatches =
            Boolean(query) &&
            [entry.venue.name, entry.building.name].some((value) =>
              value.toLowerCase().includes(query),
            );
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
            price: entry.dishes.length
              ? Math.min(...entry.dishes.map((dish) => dish.price))
              : undefined,
          };
        })
        .sort((left, right) => compareCards(request.sort, query, left, right))
        .map(({ card }) => card);
      return paginate(cards, request, totals(catalog));
    },

    async suggest(prefix) {
      const catalog = loadCatalog(repository);
      const text = prefix.trim().toLowerCase();
      const counts = new Map<string, { suggestion: CatalogSuggestion; weight: number }>();
      const add = (
        kind: CatalogSuggestion["kind"],
        label: string | undefined,
        placeId?: string,
      ) => {
        if (!label) return;
        const key = `${kind}:${label}`;
        const current = counts.get(key);
        if (current) current.weight += 1;
        else
          counts.set(key, {
            suggestion: placeId ? { kind, label, placeId } : { kind, label },
            weight: 1,
          });
      };
      const stallsPerBuilding = countStallsPerBuilding(catalog);
      for (const entry of catalog) {
        if ((stallsPerBuilding.get(entry.building.id) ?? 0) >= CATALOG_PLACE_MIN_STALLS) {
          add("place", entry.building.name, entry.building.id);
        }
        add("stall", entry.venue.name);
        for (const dish of entry.dishes) add("food_type", dish.foodTypeTag);
      }
      const kindRank = { food_type: 0, place: 1, stall: 2 } as const;
      const all = [...counts.values()];
      if (text.length < CATALOG_SUGGEST_MIN_CHARS) {
        return all
          .filter(({ suggestion }) => suggestion.kind === "food_type")
          .sort((left, right) => right.weight - left.weight)
          .slice(0, CATALOG_SUGGEST_LIMIT)
          .map(({ suggestion }) => suggestion);
      }
      const startsWith = (label: string) => label.toLowerCase().startsWith(text);
      return (
        all
          // The start of the label or of any word in it, like the RPC.
          .filter(({ suggestion }) => ` ${suggestion.label.toLowerCase()}`.includes(` ${text}`))
          .sort(
            (left, right) =>
              Number(startsWith(right.suggestion.label)) -
                Number(startsWith(left.suggestion.label)) ||
              kindRank[left.suggestion.kind] - kindRank[right.suggestion.kind] ||
              right.weight - left.weight,
          )
          .slice(0, CATALOG_SUGGEST_LIMIT)
          .map(({ suggestion }) => suggestion)
      );
    },

    async listPlaces(request) {
      const catalog = loadCatalog(repository);
      const stallsPerBuilding = countStallsPerBuilding(catalog);
      const query = request.query?.trim().toLowerCase() ?? "";
      const places = new Map<string, CatalogPlace>();
      for (const entry of catalog) {
        const { building } = entry;
        if ((stallsPerBuilding.get(building.id) ?? 0) < CATALOG_PLACE_MIN_STALLS) continue;
        if (query && !` ${building.name.toLowerCase()}`.includes(` ${query}`)) continue;
        const distanceMeters = request.coordinate
          ? calculateDistanceMeters(request.coordinate, entry.coordinate)
          : undefined;
        if (
          request.coordinate &&
          request.radiusMeters !== undefined &&
          (distanceMeters ?? Infinity) > request.radiusMeters
        ) {
          continue;
        }
        const known = places.get(building.id);
        places.set(building.id, {
          id: building.id,
          name: building.name,
          buildingType: building.type,
          venueCount: stallsPerBuilding.get(building.id) ?? 0,
          latitude: building.coordinate.latitude,
          longitude: building.coordinate.longitude,
          distanceMeters:
            known?.distanceMeters !== undefined && distanceMeters !== undefined
              ? Math.min(known.distanceMeters, distanceMeters)
              : (distanceMeters ?? known?.distanceMeters),
        });
      }
      const startsWith = (place: CatalogPlace) =>
        query && place.name.toLowerCase().startsWith(query) ? 0 : 1;
      return [...places.values()]
        .sort(
          (left, right) =>
            startsWith(left) - startsWith(right) ||
            (left.distanceMeters ?? Infinity) - (right.distanceMeters ?? Infinity) ||
            right.venueCount - left.venueCount ||
            left.name.localeCompare(right.name),
        )
        .slice(0, Math.max(1, Math.min(request.limit ?? 8, 20)));
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
        const query = request.query?.trim().toLowerCase();
        if (
          query &&
          ![entry.venue.name, entry.building.name].some((value) =>
            value.toLowerCase().includes(query),
          ) &&
          !entry.dishes.some((dish) => matchesDishFilters(dish, { query }, entry.building.name))
        ) {
          return false;
        }
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
          buildingType: first.building.type,
        };
      });
      return { releaseId: MOCK_RELEASE_ID, items };
    },
  };
}
