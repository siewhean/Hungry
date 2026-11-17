import { similarityScore } from "@/lib/ai/similarityScore";
import { calculateDistanceMeters } from "@/lib/geo/distance";
import type {
  BuildingDetail,
  DiscoveryLocationFeed,
  HungryService,
  SearchResult,
  VenueLocationSearchRequest,
} from "@/lib/services/types";
import { hungryService as mockHungryService } from "@/lib/services/mock/mockService";
import type { Coordinate, DishDetail, SearchFilters, TasteVector } from "@/types/domain";
import {
  excelRepository,
  getExcelVenueCoordinate,
  listExcelDishes,
  listExcelVenues,
} from "./repositories";

function currentLocationFrom(lat?: number, lng?: number): Coordinate | undefined {
  return typeof lat === "number" && typeof lng === "number"
    ? { latitude: lat, longitude: lng }
    : undefined;
}

function venueDistanceMeters(venueId: string, currentLocation?: Coordinate): number {
  const coordinate = getExcelVenueCoordinate(venueId);
  if (!coordinate || !currentLocation) return Number.MAX_SAFE_INTEGER;
  return calculateDistanceMeters(currentLocation, coordinate);
}

function matchesArea(value: string | undefined, areaName: string | undefined): boolean {
  if (!areaName?.trim()) return true;
  return value?.trim().toLowerCase() === areaName.trim().toLowerCase();
}

function toSearchResults(dishes: DishDetail[], tasteProfile: TasteVector): SearchResult[] {
  return dishes.map((dish) => ({
    dish,
    score: similarityScore(dish.tasteVector, tasteProfile),
  }));
}

function searchDishes(
  filters: SearchFilters,
  tasteProfile: TasteVector,
  limit?: number,
): SearchResult[] {
  const results = excelRepository.searchDishes(filters, tasteProfile);
  return toSearchResults(
    typeof limit === "number" ? results.slice(0, limit) : results,
    tasteProfile,
  );
}

async function getBuildingDetail(id: string): Promise<BuildingDetail | undefined> {
  const building = excelRepository.listBuildings().find((item) => item.id === id);
  if (!building) return undefined;
  const venues = excelRepository.listVenuesByBuilding(id);
  const dishes = venues.flatMap((venue) => excelRepository.listDishesByVenue(venue.id));
  const firstVenue = venues[0];
  const ratings = venues
    .map((venue) => {
      const rating = "rating" in venue ? Number((venue as { rating?: number }).rating) : 0;
      return Number.isFinite(rating) ? rating : 0;
    })
    .filter((rating) => rating > 0);

  return {
    ...building,
    address: firstVenue?.address ?? "",
    postalCode: firstVenue?.postalCode ?? "",
    operatingHours: firstVenue?.operatingHours ?? "Hours not provided",
    famousDishes: dishes.slice(0, 6).map((dish) => dish.name),
    totalStalls: venues.length,
    openStalls: venues.filter((venue) => venue.isOpen).length,
    avgRating: ratings.length
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : 0,
  };
}

async function searchVenuesByLocation(request: VenueLocationSearchRequest) {
  const currentLocation = currentLocationFrom(request.lat, request.lng);
  const query = request.query?.trim().toLowerCase() ?? "";
  const limit = request.limit ?? 50;
  return listExcelVenues()
    .filter((venue) => matchesArea(venue.planningArea, request.areaName))
    .filter((venue) => {
      if (!query) return true;
      return [venue.name, venue.buildingName, venue.address, venue.planningArea]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .filter((venue) => {
      if (!currentLocation || !request.radiusMeters) return true;
      return venueDistanceMeters(venue.id, currentLocation) <= request.radiusMeters;
    })
    .sort((left, right) => {
      const leftDistance = venueDistanceMeters(left.id, currentLocation);
      const rightDistance = venueDistanceMeters(right.id, currentLocation);
      return (
        leftDistance - rightDistance ||
        Number(Boolean(right.logoUrl)) - Number(Boolean(left.logoUrl)) ||
        (right.rating ?? 0) - (left.rating ?? 0)
      );
    })
    .slice(0, limit);
}

async function listDiscoveryFeedByLocation(
  request: VenueLocationSearchRequest,
): Promise<DiscoveryLocationFeed> {
  const currentLocation = currentLocationFrom(request.lat, request.lng);
  const limit = request.limit ?? 50;
  const venues = await searchVenuesByLocation(request);
  const venueIds = new Set(venues.map((venue) => venue.id));
  const candidateDishes = listExcelDishes()
    .filter((dish) => venueIds.has(dish.venueId))
    .map((dish) => {
      const distanceMeters = venueDistanceMeters(dish.venueId, currentLocation);
      return distanceMeters === Number.MAX_SAFE_INTEGER ? dish : { ...dish, distanceMeters };
    })
    .sort((left, right) => {
      const leftDistance = venueDistanceMeters(left.venueId, currentLocation);
      const rightDistance = venueDistanceMeters(right.venueId, currentLocation);
      return (
        Number(Boolean(right.imageUrl)) - Number(Boolean(left.imageUrl)) ||
        leftDistance - rightDistance ||
        right.rating - left.rating ||
        right.reviewCount - left.reviewCount
      );
    })
    .slice(0, limit);

  return {
    venues,
    results: toSearchResults(candidateDishes, {
      sweet: 5,
      spicy: 5,
      sour: 5,
      salty: 5,
      rich: 5,
      aromatic: 5,
    }),
  };
}

export const excelService: HungryService = {
  ...mockHungryService,
  discovery: {
    ...mockHungryService.discovery,
    async listBuildings() {
      return excelRepository.listBuildings();
    },
    async countVenuesInArea(lat, lng, radiusMeters, areaName) {
      const venues = await searchVenuesByLocation({
        lat,
        lng,
        radiusMeters,
        areaName,
        limit: 100_000,
      });
      return venues.length;
    },
    getBuildingDetail,
    async getVenue(id) {
      return excelRepository.getVenueById(id);
    },
    async listVenuesByBuilding(buildingId) {
      return excelRepository.listVenuesByBuilding(buildingId);
    },
    async getDish(id) {
      return excelRepository.getDishById(id);
    },
    async listDishesByVenue(venueId) {
      return excelRepository.listDishesByVenue(venueId);
    },
    async listPopularNearby(lat, lng) {
      const currentLocation = currentLocationFrom(lat, lng);
      const dishes = excelRepository.listPopularNearby();
      return currentLocation
        ? dishes
            .map((dish) => ({
              ...dish,
              distanceMeters:
                venueDistanceMeters(dish.venueId, currentLocation) === Number.MAX_SAFE_INTEGER
                  ? dish.distanceMeters
                  : venueDistanceMeters(dish.venueId, currentLocation),
            }))
            .sort((left, right) => left.distanceMeters - right.distanceMeters)
            .slice(0, 80)
        : dishes;
    },
    listDiscoveryFeedByLocation,
    searchVenuesByLocation,
    async searchDishes(filters, tasteProfile) {
      return searchDishes(filters, tasteProfile);
    },
    async decideForMe(tasteProfile, lat, lng) {
      return excelRepository.getDecideForMe(tasteProfile, {
        latitude: lat,
        longitude: lng,
        radiusMeters: 3000,
      });
    },
  },
};
