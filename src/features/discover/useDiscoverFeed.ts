import { useCallback, useMemo } from "react";
import { searchResultToDiscoverBite } from "@/features/discover/bites";
import { getDiscoverReadArgs } from "@/features/discover/discoverReadArgs";
import { useLiveDiscoverFeed } from "@/features/discover/useLiveDiscoverFeed";
import {
  getNearestBuildings,
  getNearestSingaporeArea,
  getNearestSingaporeAreaWithin,
} from "@/lib/geo/singaporeBuildings";
import { getDataRepository, getServiceProvider } from "@/lib/services/serviceProvider";
import type { DiscoveryLocationFeed } from "@/lib/services/types";
import { useCurrentPlace } from "@/features/discover/currentPlace";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useUIStore } from "@/store/useUIStore";
import type { DishDetail, VenueSummary } from "@/types/domain";
import { type DiscoverRepositoryLookup } from "@/features/discover/stallShowcase";
/** Stable empties so memos keyed on the feed do not rerun every render. */
const EMPTY_FEED_VENUES: DiscoveryLocationFeed["venues"] = [];
const EMPTY_FEED_RESULTS: DiscoveryLocationFeed["results"] = [];

/**
 * Home's data: where the diner is, the feed read for that place (live or local), and the lists of
 * stalls and dishes built from it. The screen ranks and lays these out.
 */
export function useDiscoverFeed() {
  const repository = getDataRepository();
  const isSupabaseDataSource = getServiceProvider().mode === "supabase";
  const locationPermission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualLocation = useLocationStore((state) => state.manualLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const manualPlaceName = useLocationStore((state) => state.manualPlaceName);
  const grantLocation = useLocationStore((state) => state.grantLocation);
  const clearManualLocation = useLocationStore((state) => state.clearManualLocation);
  const showToast = useUIStore((state) => state.showToast);

  const { coordinate: discoverCoordinate } = getEffectiveLocation({
    permission: locationPermission,
    currentLocation,
    manualCoordinate,
  });
  const discoverLocationLatitude = discoverCoordinate.latitude;
  const discoverLocationLongitude = discoverCoordinate.longitude;
  const {
    areaName,
    geoCellLatitude,
    geoCellLongitude,
    radiusMeters,
    needsAreaChoice: needsDiscoverAreaChoice,
  } = getDiscoverReadArgs({
    permission: locationPermission,
    currentLocation,
    manualCoordinate,
    manualLocation,
  });
  const discoverArgs = useMemo(
    () => ({
      areaName,
      geoCellLatitude,
      geoCellLongitude,
      radiusMeters,
      needsAreaChoice: needsDiscoverAreaChoice,
    }),
    [areaName, geoCellLatitude, geoCellLongitude, radiusMeters, needsDiscoverAreaChoice],
  );

  const areaBuildings = useMemo(
    () => getNearestBuildings(discoverLocationLatitude, discoverLocationLongitude, 3, 14),
    [discoverLocationLatitude, discoverLocationLongitude],
  );
  // The nearest named area, only when the phone is within ~5 km of one (not in Woodlands
  // when it is overseas). Without a name the screen says "near you".
  // With location off there is no area to name: Discover shows picks across Singapore instead.
  const discoverAreaName = needsDiscoverAreaChoice
    ? undefined
    : (manualLocation ??
      getNearestSingaporeAreaWithin(discoverLocationLatitude, discoverLocationLongitude));
  const discoverLocationLabel = needsDiscoverAreaChoice
    ? "Singapore"
    : (discoverAreaName ?? "Near you");
  const discoverAreaPhrase = needsDiscoverAreaChoice
    ? "across Singapore"
    : discoverAreaName
      ? `in ${discoverAreaName}`
      : "near you";
  const hasManualAreaPick = Boolean(manualLocation || manualCoordinate);
  const handleUseCurrentLocation = useCallback(async () => {
    if (locationPermission === "granted") {
      await clearManualLocation();
      return;
    }
    const granted = await grantLocation({ manualLocation });
    if (!granted) {
      showToast({
        message: "Location access is off. Turn it on in Settings to use your location.",
        tone: "info",
      });
    }
  }, [clearManualLocation, grantLocation, locationPermission, manualLocation, showToast]);
  // Inside a mall, hawker centre or food court the header names it instead of the area. A real
  // GPS fix or a searched place counts; a searched area or the default point is never "inside".
  const { place: currentPlace, isResolving: isCurrentPlaceResolving } = useCurrentPlace(
    (locationPermission === "granted" && !manualCoordinate) || (manualCoordinate && manualPlaceName)
      ? { latitude: discoverLocationLatitude, longitude: discoverLocationLongitude }
      : null,
  );
  const currentPlaceId = currentPlace?.id;
  // The area follows the phone: a mall or hawker centre when inside one, else the nearest area,
  // and "Singapore" while location is off.
  const discoverHeaderLabel =
    currentPlace?.name ??
    manualPlaceName ??
    discoverAreaName ??
    (needsDiscoverAreaChoice
      ? "Singapore"
      : getNearestSingaporeArea(discoverLocationLatitude, discoverLocationLongitude));

  const {
    key: discoverFeedKey,
    state: live,
    isLoading: isSupabaseDiscoveryFeedLoading,
    isRefreshing: isDiscoverRefreshing,
    reload: reloadDiscover,
  } = useLiveDiscoverFeed(
    isSupabaseDataSource,
    discoverArgs,
    currentPlaceId,
    isCurrentPlaceResolving,
  );

  const supabaseDiscoveryFeed = live?.feed ?? null;
  const loadedDiscoverFeedKey = live?.feed ? live.key : null;
  const isDiscoverFeedPartial = Boolean(live?.feed && live.phase !== "complete");
  const discoverFailure = live?.failure;
  const discoverLoadError = live?.phase === "failed" && !live.feed && live.failure !== "cancelled";
  const supabaseFeedVenues = useMemo(() => {
    if (!supabaseDiscoveryFeed) return EMPTY_FEED_VENUES;
    if (!supabaseDiscoveryFeed.needsEnrichment && !supabaseDiscoveryFeed.isFallback) {
      return supabaseDiscoveryFeed.venues;
    }
    return supabaseDiscoveryFeed.venues.map((venue) => ({
      ...venue,
      availabilityUnverified: true,
    }));
  }, [supabaseDiscoveryFeed]);
  const supabaseFeedResults = useMemo(() => {
    if (!supabaseDiscoveryFeed) return EMPTY_FEED_RESULTS;
    if (!supabaseDiscoveryFeed.isFallback) return supabaseDiscoveryFeed.results;
    return supabaseDiscoveryFeed.results.map((result) => ({
      ...result,
      dish: { ...result.dish, dietaryFlags: [] },
    }));
  }, [supabaseDiscoveryFeed]);
  // Live builds look dishes and stalls up in the feed already on screen. The synchronous
  // repository would start a full-table download (again every 45 s), miss rows past the
  // 1,000-row cap and never re-render when it lands (HOME-X5).
  const repositoryLookup = useMemo<DiscoverRepositoryLookup>(() => {
    const dishById = new Map<string, DishDetail | undefined>();
    const dishesByVenue = new Map<string, DishDetail[]>();
    const venuesByBuilding = new Map<string, VenueSummary[]>();

    if (isSupabaseDataSource) {
      for (const { dish } of supabaseFeedResults) {
        dishById.set(dish.id, dish);
        dishesByVenue.set(dish.venueId, [...(dishesByVenue.get(dish.venueId) ?? []), dish]);
      }
      for (const venue of supabaseFeedVenues) {
        venuesByBuilding.set(venue.buildingId, [
          ...(venuesByBuilding.get(venue.buildingId) ?? []),
          venue,
        ]);
      }
      return {
        getDishById: (dishId: string) => dishById.get(dishId),
        listDishesByVenue: (venueId: string) => dishesByVenue.get(venueId) ?? [],
        listVenuesByBuilding: (buildingId: string) => venuesByBuilding.get(buildingId) ?? [],
      };
    }

    return {
      getDishById: (dishId: string) => {
        if (!dishById.has(dishId)) {
          dishById.set(dishId, repository.getDishById(dishId));
        }
        return dishById.get(dishId);
      },
      listDishesByVenue: (venueId: string) => {
        const cached = dishesByVenue.get(venueId);
        if (cached) {
          return cached;
        }
        const dishes = repository.listDishesByVenue(venueId);
        dishesByVenue.set(venueId, dishes);
        dishes.forEach((dish) => {
          dishById.set(dish.id, dish);
        });
        return dishes;
      },
      listVenuesByBuilding: (buildingId: string) => {
        const cached = venuesByBuilding.get(buildingId);
        if (cached) {
          return cached;
        }
        const venues = repository.listVenuesByBuilding(buildingId);
        venuesByBuilding.set(buildingId, venues);
        return venues;
      },
    };
  }, [isSupabaseDataSource, repository, supabaseFeedResults, supabaseFeedVenues]);
  const supabaseDiscoverBites = useMemo(
    () => supabaseFeedResults.map(searchResultToDiscoverBite),
    [supabaseFeedResults],
  );
  const feedVenueHoursById = useMemo(
    () =>
      new Map(
        supabaseFeedVenues.map(
          (venue) =>
            [venue.id, venue.availabilityUnverified ? undefined : venue.operatingHours] as const,
        ),
      ),
    [supabaseFeedVenues],
  );
  // Hours for the late-night rail and chip: the live feed (live builds read nothing else),
  // otherwise the local data.
  const getVenueHours = useCallback(
    (venueId?: string) =>
      venueId
        ? feedVenueHoursById.get(venueId) ||
          (isSupabaseDataSource ? undefined : repository.getVenueById(venueId)?.operatingHours) ||
          undefined
        : undefined,
    [feedVenueHoursById, isSupabaseDataSource, repository],
  );

  const areaVenues = useMemo(() => {
    if (isSupabaseDataSource) {
      const uniqueVenues = new Map(supabaseFeedVenues.map((venue) => [venue.id, venue]));
      return Array.from(uniqueVenues.values());
    }
    const scopedVenues = areaBuildings.flatMap((building) =>
      repositoryLookup.listVenuesByBuilding(building.id),
    );
    const uniqueVenues = new Map(scopedVenues.map((venue) => [venue.id, venue]));
    return Array.from(uniqueVenues.values());
  }, [areaBuildings, isSupabaseDataSource, repositoryLookup, supabaseFeedVenues]);
  const areaDishes = useMemo(() => {
    if (isSupabaseDataSource) {
      const uniqueDishes = new Map(
        supabaseFeedResults.map((result) => [result.dish.id, result.dish]),
      );
      return Array.from(uniqueDishes.values());
    }
    return areaVenues.flatMap((venue) => repositoryLookup.listDishesByVenue(venue.id));
  }, [areaVenues, isSupabaseDataSource, repositoryLookup, supabaseFeedResults]);
  const allDiscoverVenues = useMemo(() => {
    if (isSupabaseDataSource) {
      const uniqueVenues = new Map(supabaseFeedVenues.map((venue) => [venue.id, venue]));
      return Array.from(uniqueVenues.values());
    }
    const discoveredVenues = repository
      .listBuildings()
      .flatMap((building) => repositoryLookup.listVenuesByBuilding(building.id));
    const uniqueVenues = new Map(discoveredVenues.map((venue) => [venue.id, venue]));
    return Array.from(uniqueVenues.values());
  }, [isSupabaseDataSource, repository, repositoryLookup, supabaseFeedVenues]);
  const allDiscoverDishes = useMemo(() => {
    if (isSupabaseDataSource) {
      const uniqueDishes = new Map(
        supabaseFeedResults.map((result) => [result.dish.id, result.dish]),
      );
      return Array.from(uniqueDishes.values());
    }
    return allDiscoverVenues.flatMap((venue) => repositoryLookup.listDishesByVenue(venue.id));
  }, [allDiscoverVenues, isSupabaseDataSource, repositoryLookup, supabaseFeedResults]);
  const areaDishPool = areaDishes.length ? areaDishes : allDiscoverDishes;

  return {
    repository,
    isSupabaseDataSource,
    locationPermission,
    supabaseFeedVenues,
    supabaseFeedResults,
    repositoryLookup,
    supabaseDiscoverBites,
    getVenueHours,
    discoverLocationLatitude,
    discoverLocationLongitude,
    needsDiscoverAreaChoice,
    areaBuildings,
    discoverAreaName,
    discoverLocationLabel,
    discoverAreaPhrase,
    hasManualAreaPick,
    handleUseCurrentLocation,
    currentPlaceId,
    discoverFeedKey,
    discoverHeaderLabel,
    reloadDiscover,
    areaVenues,
    allDiscoverVenues,
    areaDishPool,
    supabaseDiscoveryFeed,
    isSupabaseDiscoveryFeedLoading,
    isDiscoverFeedPartial,
    discoverLoadError,
    discoverFailure,
    isDiscoverRefreshing,
    loadedDiscoverFeedKey,
    currentPlace,
  };
}
