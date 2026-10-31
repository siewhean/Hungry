import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DISCOVER_FEED_LIMIT, searchResultToDiscoverBite } from "@/features/discover/bites";
import { reportError } from "@/lib/monitoring/reportError";
import {
  getNearestBuildings,
  getNearestSingaporeArea,
  getNearestSingaporeAreaWithin,
} from "@/lib/geo/singaporeBuildings";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import type { DiscoveryLocationFeed } from "@/lib/services/types";
import { useCurrentPlace } from "@/features/discover/currentPlace";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useUIStore } from "@/store/useUIStore";
import type { DishDetail, VenueSummary } from "@/types/domain";
import { type DiscoverRepositoryLookup } from "@/features/discover/stallShowcase";
import { readCachedDiscoverFeed, writeCachedDiscoverFeed } from "@/features/discover/feedCache";

/** Stable empties so memos keyed on the feed do not rerun every render. */
const EMPTY_FEED_VENUES: DiscoveryLocationFeed["venues"] = [];
const EMPTY_FEED_RESULTS: DiscoveryLocationFeed["results"] = [];
const DISCOVER_AREA_RADIUS_METERS = 3000;
/** Location off: picks from the whole island, read around the built-in default point. */
const DISCOVER_ISLAND_RADIUS_METERS = 30_000;
/** 500 steps per degree ≈ a 220m grid: small GPS moves keep the same Discover read. */
const DISCOVER_GEOCELL_STEPS_PER_DEGREE = 500;

/** The two reads one Home load makes: the area's stall count and its feed. */
type DiscoverReads = {
  count: Promise<number | undefined>;
  feed: Promise<DiscoveryLocationFeed | undefined>;
};

/**
 * Home's data: where the diner is, the feed read for that place (live or local), and the lists of
 * stalls and dishes built from it. The screen ranks and lays these out.
 */
export function useDiscoverFeed() {
  const repository = getDataRepository();
  const isSupabaseDataSource = getServiceProvider().mode === "supabase";
  const [supabaseDiscoverAreaCount, setSupabaseDiscoverAreaCount] = useState<number | null>(null);
  const [supabaseDiscoveryFeed, setSupabaseDiscoveryFeed] = useState<DiscoveryLocationFeed | null>(
    null,
  );
  const [isSupabaseDiscoveryFeedLoading, setIsSupabaseDiscoveryFeedLoading] = useState(false);
  const [discoverLoadError, setDiscoverLoadError] = useState(false);
  const [discoverReloadKey, setDiscoverReloadKey] = useState(0);
  const [isDiscoverRefreshing, setIsDiscoverRefreshing] = useState(false);
  // The area the cards on screen were read for: a reload of the same area keeps them.
  const [loadedDiscoverFeedKey, setLoadedDiscoverFeedKey] = useState<string | null>(null);
  const loadedFeedKeyRef = useRef<string | null>(null);
  // Reads begun while the place lookup is still out (see the feed effect).
  const speculativeReadsRef = useRef<{ key: string; reads: DiscoverReads } | null>(null);

  const locationPermission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualLocation = useLocationStore((state) => state.manualLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const manualPlaceName = useLocationStore((state) => state.manualPlaceName);
  const grantLocation = useLocationStore((state) => state.grantLocation);
  const clearManualLocation = useLocationStore((state) => state.clearManualLocation);
  const showToast = useUIStore((state) => state.showToast);

  const supabaseFeedVenues = supabaseDiscoveryFeed?.venues ?? EMPTY_FEED_VENUES;
  const supabaseFeedResults = supabaseDiscoveryFeed?.results ?? EMPTY_FEED_RESULTS;
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
    () => new Map(supabaseFeedVenues.map((venue) => [venue.id, venue.operatingHours] as const)),
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

  const { coordinate: discoverCoordinate, isApproximate: isDiscoverLocationApproximate } =
    getEffectiveLocation({
      permission: locationPermission,
      currentLocation,
      manualCoordinate,
    });
  const discoverLocationLatitude = discoverCoordinate.latitude;
  const discoverLocationLongitude = discoverCoordinate.longitude;
  // GPS jitter must not refetch Discover: reads are keyed on a ~200m grid cell.
  const discoverGeoCellLatitude =
    Math.round(discoverLocationLatitude * DISCOVER_GEOCELL_STEPS_PER_DEGREE) /
    DISCOVER_GEOCELL_STEPS_PER_DEGREE;
  const discoverGeoCellLongitude =
    Math.round(discoverLocationLongitude * DISCOVER_GEOCELL_STEPS_PER_DEGREE) /
    DISCOVER_GEOCELL_STEPS_PER_DEGREE;
  // Without a GPS fix or a manual pick the coordinate is only the built-in default,
  // so the header asks the user to choose an area instead of asserting one.
  const needsDiscoverAreaChoice = isDiscoverLocationApproximate && !manualLocation;

  const areaBuildings = useMemo(
    () => getNearestBuildings(discoverLocationLatitude, discoverLocationLongitude, 3, 14),
    [discoverLocationLatitude, discoverLocationLongitude],
  );
  // Only a manual area pick asks the server for that planning area. A GPS fix reads
  // the radius around the diner, so a stall 300 m away over an area line is not dropped.
  const discoverAreaRequest = manualLocation;
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
  const discoverRadiusMeters = needsDiscoverAreaChoice
    ? DISCOVER_ISLAND_RADIUS_METERS
    : DISCOVER_AREA_RADIUS_METERS;
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
  const discoverFeedKey = [
    discoverAreaRequest ?? "",
    discoverGeoCellLatitude,
    discoverGeoCellLongitude,
    discoverRadiusMeters ?? "",
    currentPlaceId ?? "",
  ].join("|");
  // The area follows the phone: a mall or hawker centre when inside one, else the nearest area,
  // and "Singapore" while location is off.
  const discoverHeaderLabel =
    currentPlace?.name ??
    manualPlaceName ??
    discoverAreaName ??
    (needsDiscoverAreaChoice
      ? "Singapore"
      : getNearestSingaporeArea(discoverLocationLatitude, discoverLocationLongitude));

  useEffect(() => {
    if (!isSupabaseDataSource) {
      setSupabaseDiscoverAreaCount(null);
      setSupabaseDiscoveryFeed(null);
      setIsSupabaseDiscoveryFeedLoading(false);
      return;
    }

    let isActive = true;
    let liveFeedLanded = false;
    // Keep the current feed on screen while a new area or GPS fix loads.
    setIsSupabaseDiscoveryFeedLoading(true);
    setDiscoverLoadError(false);

    // Last launch's feed for this area draws at once; the live read replaces it when it lands.
    if (discoverReloadKey === 0 && loadedFeedKeyRef.current !== discoverFeedKey) {
      void readCachedDiscoverFeed(discoverFeedKey).then((cachedFeed) => {
        if (!isActive || liveFeedLanded || !cachedFeed) return;
        setSupabaseDiscoveryFeed(cachedFeed);
        loadedFeedKeyRef.current = discoverFeedKey;
        setLoadedDiscoverFeedKey(discoverFeedKey);
      });
    }

    const readKey = `${discoverFeedKey}#${discoverReloadKey}`;
    const startReads = (): DiscoverReads => {
      const discoveryService = getHungryService().discovery;
      const reads = {
        count: discoveryService.countVenuesInArea(
          discoverGeoCellLatitude,
          discoverGeoCellLongitude,
          discoverRadiusMeters,
          discoverAreaRequest,
        ),
        feed: discoveryService.listDiscoveryFeedByLocation({
          areaName: discoverAreaRequest,
          lat: discoverGeoCellLatitude,
          lng: discoverGeoCellLongitude,
          radiusMeters: discoverRadiusMeters,
          limit: DISCOVER_FEED_LIMIT,
          buildingId: currentPlaceId,
        }),
      };
      // A read nobody ends up waiting for must not surface as an unhandled rejection.
      reads.count.catch(() => undefined);
      reads.feed.catch(() => undefined);
      return reads;
    };

    // The feed asks for the place's stalls first, so it waits for the place lookup (3 s at most).
    // The read for "no place" starts now, beside the lookup: most diners are not inside a mall,
    // and for them the answer is already there when the lookup ends.
    if (isCurrentPlaceResolving) {
      if (speculativeReadsRef.current?.key !== readKey) {
        speculativeReadsRef.current = { key: readKey, reads: startReads() };
      }
      return () => {
        isActive = false;
      };
    }

    const speculative = speculativeReadsRef.current;
    speculativeReadsRef.current = null;
    const reads = speculative?.key === readKey ? speculative.reads : startReads();

    let isFeedSettled = false;
    let isCountSettled = false;
    const finishIfSettled = () => {
      if (isActive && isFeedSettled && isCountSettled) setIsSupabaseDiscoveryFeedLoading(false);
    };
    // The feed draws the page as soon as it lands; the area count fills its line when it does.
    void reads.feed.then(
      (feed) => {
        liveFeedLanded = true;
        if (feed) void writeCachedDiscoverFeed(discoverFeedKey, feed);
        if (!isActive) return;
        setSupabaseDiscoveryFeed(feed ?? null);
        loadedFeedKeyRef.current = discoverFeedKey;
        setLoadedDiscoverFeedKey(discoverFeedKey);
        setIsDiscoverRefreshing(false);
        isFeedSettled = true;
        finishIfSettled();
      },
      (reason: unknown) => {
        liveFeedLanded = true;
        if (!isActive) return;
        reportError(reason, { surface: "discover_home_feed" });
        setDiscoverLoadError(true);
        setIsDiscoverRefreshing(false);
        isFeedSettled = true;
        finishIfSettled();
      },
    );
    // A failed count never throws away a good feed.
    void reads.count.then(
      (count) => {
        if (!isActive) return;
        setSupabaseDiscoverAreaCount(typeof count === "number" ? count : null);
        isCountSettled = true;
        finishIfSettled();
      },
      () => {
        if (!isActive) return;
        setSupabaseDiscoverAreaCount(null);
        isCountSettled = true;
        finishIfSettled();
      },
    );

    return () => {
      isActive = false;
    };
  }, [
    discoverAreaRequest,
    discoverFeedKey,
    discoverRadiusMeters,
    discoverGeoCellLatitude,
    discoverGeoCellLongitude,
    discoverReloadKey,
    isSupabaseDataSource,
    isCurrentPlaceResolving,
    currentPlaceId,
  ]);

  const reloadDiscover = useCallback(async () => {
    setIsDiscoverRefreshing(true);
    setDiscoverReloadKey((key) => key + 1);
    if (!isSupabaseDataSource) {
      setIsDiscoverRefreshing(false);
    }
  }, [isSupabaseDataSource]);

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
    supabaseDiscoverAreaCount,
    supabaseDiscoveryFeed,
    isSupabaseDiscoveryFeedLoading,
    discoverLoadError,
    isDiscoverRefreshing,
    loadedDiscoverFeedKey,
    currentPlace,
  };
}
