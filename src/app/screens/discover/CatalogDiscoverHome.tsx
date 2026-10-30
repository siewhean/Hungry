import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, MapPinned, Search, Utensils } from "lucide-react-native";
import {
  useIsFocused,
  useNavigation,
  useScrollToTop,
  type CompositeNavigationProp,
} from "@react-navigation/native";
import type { MaterialTopTabNavigationProp } from "@react-navigation/material-top-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { MainTabParamList, RootStackParamList } from "@/app/navigation/navigationTypes";
import { WelcomeBackCard } from "@/components/home/WelcomeBackCard";
import { AccessibleImage, AppText, Button, EmptyState, Skeleton } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { isRelease01BlockedImageUrl } from "@/constants/release01";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  getNearestSingaporeArea,
  getNearestSingaporeAreaWithin,
} from "@/lib/geo/singaporeBuildings";
import type {
  CatalogPageRequest,
  CatalogRawDishCard,
  CatalogRawVenueCard,
} from "@/lib/services/catalog";
import { reportError } from "@/lib/monitoring/reportError";
import { CatalogAccessError } from "@/lib/services/catalog";
import {
  clearCatalogDiagnostics,
  getCatalogDiagnosticsSnapshot,
  recordCatalogDiagnostic,
  summarizeCatalogRequest,
  type CatalogDiagnosticEvent,
} from "@/lib/services/catalog/diagnostics";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { CatalogDiagnosticsModal } from "./CatalogDiagnosticsModal";

type RootNavigation = CompositeNavigationProp<
  MaterialTopTabNavigationProp<MainTabParamList, "Discover">,
  NativeStackNavigationProp<RootStackParamList>
>;

type CatalogFilter = "all" | "halal" | "japanese" | "western" | "value";

const FILTERS: readonly { id: CatalogFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "halal", label: "Halal" },
  { id: "japanese", label: "Japanese" },
  { id: "western", label: "Western" },
  { id: "value", label: "Value" },
];

/** ~200 m grid: GPS jitter between foreground fixes must not refetch Home. */
const GEOCELL_STEPS_PER_DEGREE = 500;

export const CATALOG_HOME_LOAD_ERROR =
  "We couldn't load food near you. Check your connection and try again.";

export function roundToGeocell(coordinate: { latitude: number; longitude: number }) {
  return {
    latitude: Math.round(coordinate.latitude * GEOCELL_STEPS_PER_DEGREE) / GEOCELL_STEPS_PER_DEGREE,
    longitude:
      Math.round(coordinate.longitude * GEOCELL_STEPS_PER_DEGREE) / GEOCELL_STEPS_PER_DEGREE,
  };
}

/** "450 m" under a kilometre, "1.2 km" from there. */
export function formatCatalogDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

/** Location off: picks from the whole island, read around the built-in default point. */
const ISLAND_RADIUS_METERS = 30_000;

function requestForFilter(
  filter: CatalogFilter,
  coordinate: { latitude: number; longitude: number },
  islandWide: boolean,
): CatalogPageRequest {
  return {
    coordinate,
    radiusMeters: islandWide ? ISLAND_RADIUS_METERS : 3_000,
    limit: 24,
    sort: "nearby",
    dietaryFlags: filter === "halal" ? ["halal"] : [],
    cuisineTags: filter === "japanese" || filter === "western" ? [filter] : [],
    maxPrice: filter === "value" ? 8 : undefined,
  };
}

function displayImageUrl(value: string | null | undefined): string | undefined {
  const url = value?.trim();
  return url && !isRelease01BlockedImageUrl(url) ? url : undefined;
}

function uniqueDishes(items: CatalogRawDishCard[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.venueId}:${item.name.trim().toLocaleLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function placeLine(
  distanceMeters: number | undefined,
  buildingName: string | undefined,
  showDistance: boolean,
) {
  if (showDistance && distanceMeters !== undefined) return formatCatalogDistance(distanceMeters);
  return buildingName ?? "Singapore";
}

function CatalogDiscoverSkeleton() {
  const { radii, spacing } = useHungryTheme();
  return (
    <View style={{ gap: spacing[5] }} testID="catalog-discover-skeleton">
      <View style={{ flexDirection: "row", gap: spacing[3] }}>
        <Skeleton width="48%" height={132} borderRadius={radii.lg} />
        <Skeleton width="48%" height={132} borderRadius={radii.lg} />
      </View>
      <Skeleton width="55%" height={22} />
      <View style={{ flexDirection: "row", gap: spacing[3] }}>
        <Skeleton width={190} height={220} borderRadius={radii.lg} />
        <Skeleton width={190} height={220} borderRadius={radii.lg} />
      </View>
    </View>
  );
}

function RawDishCard({
  item,
  position,
  releaseId,
  showDistance,
}: {
  item: CatalogRawDishCard;
  position: number;
  releaseId?: string;
  showDistance: boolean;
}) {
  const navigation = useNavigation<RootNavigation>();
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const imageUrl = displayImageUrl(item.imageUrl);
  const place = placeLine(item.distanceMeters, item.buildingName, showDistance);
  const rated = (item.reviewCount ?? 0) > 0 && item.rating !== undefined;
  const label = [
    item.name,
    item.venueName,
    item.price !== undefined ? `S$${item.price.toFixed(2)}` : undefined,
    rated ? `rated ${item.rating!.toFixed(1)} from ${item.reviewCount} reviews` : undefined,
    showDistance && item.distanceMeters !== undefined ? `${place} away` : place,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      accessibilityHint="Opens the dish"
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={() => {
        trackAnalyticsEvent("discover_card_opened", {
          surface: "catalog_home",
          rail: "nearby_dishes",
          kind: "dish",
          position,
        });
        // The offline copy only has the read-only catalog page. Live catalog ids are dish ids,
        // so they open the dish page, which falls back to the catalog record if it can't load.
        if (releaseId?.startsWith("excel-fallback")) {
          navigation.navigate("CatalogRawDetail", { kind: "dish", id: item.id, releaseId });
          return;
        }
        navigation.navigate("DishDetail", {
          dishId: item.id,
          source: "home",
          catalogFallback: { releaseId },
        });
      }}
      style={{ width: 190 }}
    >
      <View
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          overflow: "hidden",
        }}
      >
        <View style={{ backgroundColor: palette.bgSoft, height: 118 }}>
          {imageUrl ? (
            <AccessibleImage
              accessibilityLabel={`${item.name} menu image`}
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri: imageUrl }}
              style={{ height: "100%", width: "100%" }}
            />
          ) : (
            <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
              <Utensils color={palette.textMuted} size={24} />
            </View>
          )}
          {/* Data-quality badges are for internal builds; diners do not act on them. */}
          {FEATURE_FLAGS.catalogDiagnosticsEnabled && item.verificationStatus !== "approved" ? (
            <View
              style={{
                backgroundColor: palette.surface,
                borderRadius: radii.pill,
                left: spacing[2],
                paddingHorizontal: spacing[2],
                paddingVertical: spacing[1],
                position: "absolute",
                top: spacing[2],
              }}
            >
              <AppText tone="muted" variant="micro">
                {item.verificationStatus === "verified" ? "Source verified" : "Unverified"}
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={{ gap: spacing[1], minHeight: 94, padding: spacing[2] }}>
          <AppText numberOfLines={2} variant="bodyBold">
            {item.name}
          </AppText>
          <AppText numberOfLines={1} tone="secondary" variant="micro">
            {item.venueName}
          </AppText>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <AppText tone="muted" variant="micro" numberOfLines={1} style={{ flexShrink: 1 }}>
              {rated ? `★ ${item.rating!.toFixed(1)} (${item.reviewCount}) · ` : ""}
              {place}
            </AppText>
            {item.price !== undefined ? (
              <AppText style={{ color: palette.text }} variant="price">
                S${item.price.toFixed(2)}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function RawVenueRow({
  item,
  position,
  releaseId,
  showDistance,
}: {
  item: CatalogRawVenueCard;
  position: number;
  releaseId?: string;
  showDistance: boolean;
}) {
  const navigation = useNavigation<RootNavigation>();
  const { componentRadii, palette, spacing } = useHungryTheme();
  const imageUrl =
    displayImageUrl(item.imageUrl) ?? displayImageUrl(item.representativeDish?.imageUrl);
  const subtitle = item.representativeDish?.name ?? `${item.menuCount} menu items`;
  const place =
    showDistance && item.distanceMeters !== undefined
      ? `${formatCatalogDistance(item.distanceMeters)} away`
      : (item.buildingName ?? "Singapore");

  return (
    <Pressable
      accessibilityHint="Opens the stall"
      accessibilityLabel={`${item.name}, ${subtitle}, ${place}`}
      accessibilityRole="button"
      onPress={() => {
        trackAnalyticsEvent("discover_card_opened", {
          surface: "catalog_home",
          rail: "nearby_stalls",
          kind: "stall",
          position,
        });
        // The offline copy is served only while the live catalog is down, and StallDetail reads
        // the live catalog, so offline rows open the read-only page built from the copy.
        if (releaseId?.startsWith("excel-fallback")) {
          navigation.navigate("CatalogRawDetail", { kind: "venue", id: item.id, releaseId });
          return;
        }
        navigation.navigate("StallDetail", { venueId: item.id });
      }}
    >
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: spacing[3],
          paddingVertical: spacing[2],
        }}
      >
        <View
          style={{
            backgroundColor: palette.bgSoft,
            borderRadius: componentRadii.card,
            height: 58,
            overflow: "hidden",
            width: 58,
          }}
        >
          {imageUrl ? (
            <AccessibleImage
              accessibilityLabel={`${item.name} stall or menu image`}
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri: imageUrl }}
              style={{ height: "100%", width: "100%" }}
            />
          ) : (
            <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
              <Utensils color={palette.textMuted} size={20} />
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: spacing[1] }}>
          <AppText numberOfLines={1} variant="bodyBold">
            {item.name}
          </AppText>
          <AppText numberOfLines={1} tone="secondary" variant="micro">
            {subtitle}
          </AppText>
          <AppText tone="muted" variant="micro">
            {place}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * The offline Home: shown in Supabase builds only when the live discovery feed fails. Reads the
 * authenticated catalog first, with the read-only Excel copy as the outage fallback.
 * `onRetryLive` (from the entry) makes Retry and pull-to-refresh try the live Home again.
 */
export function CatalogDiscoverHome({ onRetryLive }: { onRetryLive?: () => void }) {
  const navigation = useNavigation<RootNavigation>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { palette, radii, semanticSpacing, spacing } = useHungryTheme();
  const permission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const manualLocation = useLocationStore((state) => state.manualLocation);
  const manualPlaceName = useLocationStore((state) => state.manualPlaceName);
  const grantLocation = useLocationStore((state) => state.grantLocation);
  const clearManualLocation = useLocationStore((state) => state.clearManualLocation);
  const showToast = useUIStore((state) => state.showToast);
  const prefersHalal = useProfileStore((state) =>
    state.profile.dietaryPreferences.includes("halal"),
  );
  const service = getCatalogRawService();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  // A halal diner starts on the Halal chip; they can still switch to All.
  const [filter, setFilter] = useState<CatalogFilter>(() => (prefersHalal ? "halal" : "all"));
  // A profile that arrives after Home mounts (sign-in on a new device) still applies the halal
  // preset once, unless the diner has already picked a chip themselves.
  const filterTouchedRef = useRef(false);
  useEffect(() => {
    if (!prefersHalal || filterTouchedRef.current) return;
    filterTouchedRef.current = true;
    setFilter((current) => (current === "all" ? "halal" : current));
  }, [prefersHalal]);
  const [dishes, setDishes] = useState<CatalogRawDishCard[]>([]);
  const [venues, setVenues] = useState<CatalogRawVenueCard[]>([]);
  const [releaseId, setReleaseId] = useState<string | undefined>();
  const [totals, setTotals] = useState({ dishes: 0, venues: 0 });
  const [loading, setLoading] = useState(true);
  const [userRefreshing, setUserRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticsVisible, setDiagnosticsVisible] = useState(false);
  const [diagnosticEvents, setDiagnosticEvents] = useState<CatalogDiagnosticEvent[]>(() =>
    getCatalogDiagnosticsSnapshot(),
  );
  const requestVersion = useRef(0);
  const impressionKey = useRef<string | null>(null);

  const { coordinate: effectiveCoordinate, isApproximate } = getEffectiveLocation({
    permission,
    currentLocation,
    manualCoordinate,
  });
  const cell = roundToGeocell(effectiveCoordinate);
  const cellLatitude = cell.latitude;
  const cellLongitude = cell.longitude;
  const needsAreaChoice = isApproximate && !manualLocation;
  const request = useMemo(
    () =>
      requestForFilter(
        filter,
        { latitude: cellLatitude, longitude: cellLongitude },
        needsAreaChoice,
      ),
    [cellLatitude, cellLongitude, filter, needsAreaChoice],
  );
  // Which filter and area the cards on screen were loaded for. The last good page stays only
  // for a refresh or Retry of the same request; a new filter or area never shows old cards.
  const requestKey = `${filter}:${cellLatitude}:${cellLongitude}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const contentIsCurrent = loadedKey === requestKey;
  const isOfflineCatalog = Boolean(releaseId?.startsWith("excel-fallback"));
  // Distances from the built-in default point would be made up, so they are hidden.
  const showDistance = !needsAreaChoice;
  // Home names where the phone is, in orange, under a small "You are at"; "Singapore" while
  // location is off.
  const areaLabel =
    manualPlaceName ??
    manualLocation ??
    (needsAreaChoice
      ? "Singapore"
      : (getNearestSingaporeAreaWithin(
          effectiveCoordinate.latitude,
          effectiveCoordinate.longitude,
        ) ?? getNearestSingaporeArea(effectiveCoordinate.latitude, effectiveCoordinate.longitude)));
  const hasManualPick = Boolean(manualLocation || manualCoordinate);

  const refreshDiagnosticEvents = useCallback(() => {
    setDiagnosticEvents(getCatalogDiagnosticsSnapshot());
  }, []);

  const load = useCallback(async () => {
    const startedAt = Date.now();
    if (!service) {
      setError(CATALOG_HOME_LOAD_ERROR);
      setLoading(false);
      recordCatalogDiagnostic({
        operation: "discover",
        durationMs: Date.now() - startedAt,
        errorKind: "service_unavailable",
        releaseId: undefined,
        request: summarizeCatalogRequest(request),
        resultCount: 0,
        succeeded: false,
      });
      refreshDiagnosticEvents();
      return;
    }

    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const [dishPage, venuePage] = await Promise.all([
        service.listDishes(request),
        service.listVenues({ ...request, limit: 24 }),
      ]);
      if (version !== requestVersion.current) return;
      const nextDishes = uniqueDishes(dishPage.items);
      const nextReleaseId = dishPage.releaseId || venuePage.releaseId || undefined;
      setDishes(nextDishes);
      setVenues(venuePage.items);
      setTotals({ dishes: dishPage.totals.dishes, venues: venuePage.totals.venues });
      setReleaseId(nextReleaseId);
      setLoadedKey(requestKey);
      recordCatalogDiagnostic({
        operation: "discover",
        durationMs: Date.now() - startedAt,
        releaseId: nextReleaseId,
        request: summarizeCatalogRequest(request),
        resultCount: nextDishes.length + venuePage.items.length,
        succeeded: true,
      });
    } catch (loadError) {
      if (version !== requestVersion.current) return;
      // A dropped connection is the diner's network, not a defect worth an alert.
      const isNetwork = loadError instanceof CatalogAccessError && loadError.kind === "network";
      if (!isNetwork) reportError(loadError, { surface: "catalog_discover_home" });
      // A failed refresh keeps the last good page with the error inline above it; a failed new
      // filter or area shows the full error state (see contentIsCurrent).
      setError(CATALOG_HOME_LOAD_ERROR);
      recordCatalogDiagnostic({
        operation: "discover",
        durationMs: Date.now() - startedAt,
        errorKind:
          loadError instanceof CatalogAccessError
            ? loadError.kind
            : loadError instanceof Error
              ? loadError.name
              : "unknown",
        releaseId: undefined,
        request: summarizeCatalogRequest(request),
        resultCount: 0,
        succeeded: false,
      });
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
        setUserRefreshing(false);
      }
      refreshDiagnosticEvents();
    }
  }, [refreshDiagnosticEvents, request, requestKey, service]);

  /** Pull-to-refresh and Retry: skip the 60 s page cache so the tap really refetches. */
  const reloadFresh = useCallback(() => {
    service?.clearCache();
    if (onRetryLive) {
      onRetryLive();
      return;
    }
    void load();
  }, [load, onRetryLive, service]);

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  useEffect(() => {
    // Only once the page for this filter and area is on screen: right after a change the old
    // page's counts are still in state and must not be logged under the new key.
    if (loading || !isFocused || !contentIsCurrent) return;
    const key = `${releaseId ?? ""}:${requestKey}`;
    if (impressionKey.current === key) return;
    impressionKey.current = key;
    if (dishes.length) {
      trackAnalyticsEvent("discover_rail_impression", {
        surface: "catalog_home",
        rail: "nearby_dishes",
        count: Math.min(dishes.length, 8),
      });
    }
    if (venues.length) {
      trackAnalyticsEvent("discover_rail_impression", {
        surface: "catalog_home",
        rail: "nearby_stalls",
        count: Math.min(venues.length, 8),
      });
    }
  }, [contentIsCurrent, dishes.length, isFocused, loading, releaseId, requestKey, venues.length]);

  const openBrowse = useCallback(
    (browseMode: "dishes" | "stalls", source: "tile" | "see_all") => {
      trackAnalyticsEvent("discover_see_all_tapped", {
        surface: "catalog_home",
        collection: browseMode,
        source,
      });
      navigation.navigate("SearchResults", { browseMode });
    },
    [navigation],
  );

  const selectFilter = useCallback((next: CatalogFilter) => {
    trackAnalyticsEvent("discover_chip_tapped", {
      surface: "catalog_home",
      chip: next,
      selected: true,
    });
    filterTouchedRef.current = true;
    setFilter(next);
  }, []);

  const handleUseCurrentLocation = useCallback(async () => {
    if (permission === "granted") {
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
  }, [clearManualLocation, grantLocation, manualLocation, permission, showToast]);

  const diagnostics = (
    <CatalogDiagnosticsModal
      events={diagnosticEvents}
      onClear={() => {
        clearCatalogDiagnostics();
        refreshDiagnosticEvents();
      }}
      onClose={() => setDiagnosticsVisible(false)}
      releaseId={releaseId}
      totals={totals}
      visible={diagnosticsVisible}
    />
  );

  // Cards loaded for another filter or area do not count: the skeleton (or the full error)
  // shows instead of them.
  const hasContent = contentIsCurrent && (dishes.length > 0 || venues.length > 0);
  const showSkeleton = loading && !hasContent && !error;
  const showSourcePill = FEATURE_FLAGS.catalogDiagnosticsEnabled || isOfflineCatalog;
  const hasFilter = filter !== "all";

  let body: ReactNode;
  if (showSkeleton) {
    body = <CatalogDiscoverSkeleton />;
  } else if (error && !hasContent) {
    body = (
      <EmptyState body={error} ctaLabel="Retry" onPress={reloadFresh} title="Couldn't load Home" />
    );
  } else if (!hasContent) {
    body = (
      <EmptyState
        body={
          hasFilter
            ? "Try another filter or browse every stall."
            : "Try another area, or try again in a moment."
        }
        ctaLabel={hasFilter ? "Show all" : "Retry"}
        onPress={hasFilter ? () => selectFilter("all") : reloadFresh}
        title={hasFilter ? "No nearby matches" : "Nothing listed nearby yet"}
      />
    );
  } else {
    body = (
      <>
        {error ? (
          <View
            accessibilityRole="alert"
            style={{
              backgroundColor: palette.bgSoft,
              borderRadius: radii.lg,
              gap: spacing[2],
              padding: spacing[3],
            }}
            testID="catalog-discover-error-banner"
          >
            <AppText variant="bodySmall">{error}</AppText>
            <Button label="Retry" onPress={reloadFresh} variant="secondary" />
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <Pressable
            accessibilityLabel="Browse stalls and restaurants"
            accessibilityRole="button"
            onPress={() => openBrowse("stalls", "tile")}
            style={{
              backgroundColor: palette.bgSoft,
              borderRadius: radii.lg,
              flex: 1,
              gap: spacing[2],
              minHeight: 116,
              padding: spacing[3],
            }}
          >
            <Utensils color={palette.orange} size={26} />
            <AppText variant="bodyBold">Stalls & Restaurants</AppText>
            <AppText tone="secondary" variant="micro">
              Browse the full directory
            </AppText>
          </Pressable>
          <Pressable
            accessibilityLabel="Browse dishes"
            accessibilityRole="button"
            onPress={() => openBrowse("dishes", "tile")}
            style={{
              backgroundColor: palette.bgSoft,
              borderRadius: radii.lg,
              flex: 1,
              gap: spacing[2],
              minHeight: 116,
              padding: spacing[3],
            }}
          >
            <Search color={palette.orange} size={26} />
            <AppText variant="bodyBold">Dishes</AppText>
            <AppText tone="secondary" variant="micro">
              Find your craving first
            </AppText>
          </Pressable>
        </View>

        {dishes.length ? (
          <View style={{ gap: spacing[3] }}>
            <Pressable
              accessibilityLabel="See all nearby dishes"
              accessibilityRole="button"
              onPress={() => openBrowse("dishes", "see_all")}
              style={{ alignItems: "center", flexDirection: "row", gap: spacing[2], minHeight: 44 }}
            >
              <AppText accessibilityRole="header" variant="h3">
                Nearby dishes
              </AppText>
              <ChevronRight color={palette.textMuted} size={20} />
            </Pressable>
            <ScrollView
              contentContainerStyle={{ gap: spacing[3] }}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {dishes.slice(0, 8).map((item, index) => (
                <RawDishCard
                  key={item.id}
                  item={item}
                  position={index}
                  releaseId={releaseId}
                  showDistance={showDistance}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {venues.length ? (
          <View style={{ gap: spacing[2] }}>
            <Pressable
              accessibilityLabel="See all nearby stalls"
              accessibilityRole="button"
              onPress={() => openBrowse("stalls", "see_all")}
              style={{ alignItems: "center", flexDirection: "row", gap: spacing[2], minHeight: 44 }}
            >
              <AppText accessibilityRole="header" variant="h3">
                {showDistance ? "Stalls near you" : "Stalls"}
              </AppText>
              <ChevronRight color={palette.textMuted} size={20} />
            </Pressable>
            {venues.slice(0, 8).map((item, index) => (
              <RawVenueRow
                key={item.id}
                item={item}
                position={index}
                releaseId={releaseId}
                showDistance={showDistance}
              />
            ))}
          </View>
        ) : null}
      </>
    );
  }

  return (
    <View
      style={{ backgroundColor: palette.bg, flex: 1, paddingTop: insets.top }}
      testID="catalog-discover-root"
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          gap: spacing[5],
          paddingBottom: spacing[12],
          paddingHorizontal: semanticSpacing.screenEdge,
          paddingTop: spacing[3],
        }}
        refreshControl={
          <RefreshControl
            refreshing={userRefreshing}
            onRefresh={() => {
              setUserRefreshing(true);
              reloadFresh();
            }}
            tintColor={palette.orange}
          />
        }
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: palette.bg }}
        testID="catalog-discover-screen"
      >
        {/* Where the diner is: it follows the phone's location, so there is no area to pick. */}
        <View
          style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}
        >
          <View style={{ flex: 1, gap: spacing[1] }}>
            <View
              accessible
              accessibilityLabel={`You are at ${areaLabel}`}
              style={{ minHeight: 44, justifyContent: "center" }}
              testID="catalog-discover-area"
            >
              <AppText tone="secondary" variant="bodySmall">
                You are at
              </AppText>
              <AppText numberOfLines={1} style={{ color: palette.orangeText }} variant="h2">
                {areaLabel}
              </AppText>
            </View>
            {needsAreaChoice ? (
              <Pressable
                accessibilityHint="Shows stalls near you instead of picks across Singapore"
                accessibilityLabel="Turn on location"
                accessibilityRole="button"
                onPress={() => void handleUseCurrentLocation()}
                style={{ justifyContent: "center", minHeight: 44 }}
              >
                <AppText tone="secondary" variant="micro">
                  Location is off, so these are picks across Singapore.{" "}
                  <AppText style={{ color: palette.orangeText, fontWeight: "700" }} variant="micro">
                    Turn on location
                  </AppText>
                </AppText>
              </Pressable>
            ) : null}
            {hasManualPick ? (
              <Pressable
                accessibilityLabel="Use current location"
                accessibilityRole="button"
                onPress={() => void handleUseCurrentLocation()}
                style={{ alignSelf: "flex-start", justifyContent: "center", minHeight: 44 }}
              >
                <AppText style={{ color: palette.orangeText, fontWeight: "700" }} variant="micro">
                  Use current location
                </AppText>
              </Pressable>
            ) : null}
            {showSourcePill ? (
              <Pressable
                accessibilityLabel={
                  isOfflineCatalog ? "Offline catalog active" : "Live catalog active"
                }
                accessibilityHint={
                  FEATURE_FLAGS.catalogDiagnosticsEnabled
                    ? "Long press to open catalog diagnostics"
                    : undefined
                }
                accessibilityRole={FEATURE_FLAGS.catalogDiagnosticsEnabled ? "button" : "text"}
                disabled={!FEATURE_FLAGS.catalogDiagnosticsEnabled}
                onLongPress={() => {
                  refreshDiagnosticEvents();
                  setDiagnosticsVisible(true);
                }}
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: isOfflineCatalog ? palette.bgSoft : palette.surface,
                  borderColor: isOfflineCatalog ? palette.orange : palette.border,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  paddingHorizontal: spacing[2],
                  paddingVertical: spacing[1],
                }}
                testID={isOfflineCatalog ? "catalog-source-excel" : "catalog-source-supabase"}
              >
                <AppText
                  style={{ color: isOfflineCatalog ? palette.orangeText : palette.textSecondary }}
                  variant="micro"
                >
                  {isOfflineCatalog ? "Offline catalog" : "Live catalog"}
                </AppText>
              </Pressable>
            ) : null}
          </View>
          {FEATURE_FLAGS.mapEnabled ? (
            <Pressable
              accessibilityLabel="Open map"
              accessibilityRole="button"
              onPress={() => navigation.navigate("DiscoverMap")}
              style={{
                alignItems: "center",
                backgroundColor: palette.bgSoft,
                borderRadius: radii.md,
                justifyContent: "center",
                minHeight: 44,
                minWidth: 44,
                padding: spacing[3],
              }}
            >
              <MapPinned color={palette.text} size={20} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          accessibilityLabel="Search dishes and stalls"
          accessibilityRole="button"
          onPress={() => {
            trackAnalyticsEvent("discover_search_opened", { surface: "catalog_home" });
            navigation.navigate("SearchHome");
          }}
          style={{
            alignItems: "center",
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radii.lg,
            borderWidth: 1,
            flexDirection: "row",
            gap: spacing[2],
            padding: spacing[3],
          }}
        >
          <Search color={palette.textMuted} size={20} />
          <AppText tone="muted" variant="body">
            Dishes, stalls, or hawker centres…
          </AppText>
        </Pressable>

        <ScrollView
          contentContainerStyle={{ gap: spacing[2] }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {FILTERS.map((option) => {
            const active = filter === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityLabel={`${option.label} filter`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => selectFilter(option.id)}
                style={{
                  backgroundColor: active ? palette.orange : palette.bgSoft,
                  borderRadius: radii.pill,
                  justifyContent: "center",
                  minHeight: 44,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                }}
              >
                <AppText
                  style={{ color: active ? palette.textOnOrange : palette.text }}
                  variant="bodyBold"
                >
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        {hasContent ? (
          <WelcomeBackCard
            horizontalPadding={0}
            visible={isFocused}
            onOpenDish={(dishId) => navigation.navigate("DishDetail", { dishId })}
            onOpenSaved={() => navigation.navigate("Favourites")}
          />
        ) : null}

        {body}
      </ScrollView>
      {diagnostics}
    </View>
  );
}
