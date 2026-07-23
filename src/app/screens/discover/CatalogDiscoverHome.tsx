import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { MapPinned, Search, Utensils } from "lucide-react-native";
import { useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import type { MaterialTopTabNavigationProp } from "@react-navigation/material-top-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { MainTabParamList, RootStackParamList } from "@/app/navigation/navigationTypes";
import { AccessibleImage, AppText, EmptyState, Skeleton } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { isRelease01BlockedImageUrl } from "@/constants/release01";
import type {
  CatalogPageRequest,
  CatalogRawDishCard,
  CatalogRawVenueCard,
} from "@/lib/services/catalog";
import { CatalogAccessError } from "@/lib/services/catalog";
import {
  clearCatalogDiagnostics,
  getCatalogDiagnosticsSnapshot,
  recordCatalogDiagnostic,
  summarizeCatalogRequest,
  type CatalogDiagnosticEvent,
} from "@/lib/services/catalog/diagnostics";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import { useLocationStore } from "@/store/useLocationStore";
import { useHungryTheme } from "@/theme";
import { CatalogDiagnosticsModal } from "./CatalogDiagnosticsModal";

type RootNavigation = CompositeNavigationProp<
  MaterialTopTabNavigationProp<MainTabParamList, "Discover">,
  NativeStackNavigationProp<RootStackParamList>
>;

type CatalogFilter = "all" | "halal" | "japanese" | "western" | "value";

const FILTERS: readonly { id: CatalogFilter; label: string }[] = [
  { id: "all", label: "Near me" },
  { id: "halal", label: "Halal" },
  { id: "japanese", label: "Japanese" },
  { id: "western", label: "Western" },
  { id: "value", label: "Value" },
];

function requestForFilter(
  filter: CatalogFilter,
  coordinate: { latitude: number; longitude: number },
): CatalogPageRequest {
  return {
    coordinate,
    radiusMeters: 3_000,
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

function CatalogDiscoverSkeleton() {
  const { radii, spacing } = useHungryTheme();
  return (
    <View style={{ gap: spacing[5], padding: spacing[4] }}>
      <Skeleton width="42%" height={24} />
      <Skeleton width="100%" height={52} borderRadius={radii.lg} />
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

function RawDishCard({ item, releaseId }: { item: CatalogRawDishCard; releaseId?: string }) {
  const navigation = useNavigation<RootNavigation>();
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const imageUrl = displayImageUrl(item.imageUrl);

  return (
    <Pressable
      accessibilityLabel={`Open ${item.name}`}
      accessibilityRole="button"
      onPress={() =>
        navigation.navigate("CatalogRawDetail", { kind: "dish", id: item.id, releaseId })
      }
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
              <AppText tone="muted" variant="micro">
                Image unavailable
              </AppText>
            </View>
          )}
          {item.verificationStatus !== "approved" ? (
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
            <AppText tone="muted" variant="micro">
              {item.distanceMeters === undefined
                ? (item.buildingName ?? "Singapore")
                : `${Math.round(item.distanceMeters)} m`}
            </AppText>
            {item.price !== undefined ? (
              <AppText style={{ color: palette.orange }} variant="price">
                S${item.price.toFixed(2)}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function RawVenueRow({ item, releaseId }: { item: CatalogRawVenueCard; releaseId?: string }) {
  const navigation = useNavigation<RootNavigation>();
  const { componentRadii, palette, spacing } = useHungryTheme();
  const imageUrl =
    displayImageUrl(item.imageUrl) ?? displayImageUrl(item.representativeDish?.imageUrl);

  return (
    <Pressable
      accessibilityLabel={`Open ${item.name}`}
      accessibilityRole="button"
      onPress={() =>
        navigation.navigate("CatalogRawDetail", { kind: "venue", id: item.id, releaseId })
      }
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
            {item.representativeDish?.name ?? `${item.menuCount} menu items`}
          </AppText>
          <AppText tone="muted" variant="micro">
            {item.distanceMeters === undefined
              ? (item.buildingName ?? "Singapore")
              : `${Math.round(item.distanceMeters)} m away`}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

/** Supabase-first, authenticated catalog surface with read-only Excel outage fallback. */
export function CatalogDiscoverHome() {
  const navigation = useNavigation<RootNavigation>();
  const { palette, radii, semanticSpacing, spacing } = useHungryTheme();
  const coordinate = useLocationStore((state) => state.currentLocation);
  const service = getCatalogRawService();
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [dishes, setDishes] = useState<CatalogRawDishCard[]>([]);
  const [venues, setVenues] = useState<CatalogRawVenueCard[]>([]);
  const [releaseId, setReleaseId] = useState<string | undefined>();
  const [totals, setTotals] = useState({ dishes: 0, venues: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticsVisible, setDiagnosticsVisible] = useState(false);
  const [diagnosticEvents, setDiagnosticEvents] = useState<CatalogDiagnosticEvent[]>(() =>
    getCatalogDiagnosticsSnapshot(),
  );
  const requestVersion = useRef(0);
  const request = useMemo(() => requestForFilter(filter, coordinate), [coordinate, filter]);
  const isOfflineCatalog = Boolean(releaseId?.startsWith("excel-fallback"));

  const refreshDiagnosticEvents = useCallback(() => {
    setDiagnosticEvents(getCatalogDiagnosticsSnapshot());
  }, []);

  const load = useCallback(async () => {
    const startedAt = Date.now();
    if (!service) {
      const unavailableMessage = "The authenticated catalog service is unavailable.";
      setError(unavailableMessage);
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
      setDishes([]);
      setVenues([]);
      setReleaseId(undefined);
      setError(loadError instanceof Error ? loadError.message : "Could not load the catalog.");
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
      if (version === requestVersion.current) setLoading(false);
      refreshDiagnosticEvents();
    }
  }, [refreshDiagnosticEvents, request, service]);

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  const openBrowse = useCallback(
    (browseMode: "dishes" | "stalls") => navigation.navigate("SearchResults", { browseMode }),
    [navigation],
  );

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

  if (loading && !dishes.length && !venues.length) {
    return (
      <>
        <CatalogDiscoverSkeleton />
        {diagnostics}
      </>
    );
  }
  if (error && !dishes.length && !venues.length) {
    return (
      <>
        <EmptyState
          body={error}
          ctaLabel="Retry"
          onPress={() => void load()}
          title="Catalog unavailable"
        />
        {diagnostics}
      </>
    );
  }
  if (!dishes.length && !venues.length) {
    const hasFilter = filter !== "all";
    return (
      <>
        <EmptyState
          body={
            hasFilter
              ? "Try another filter or browse the full authenticated directory."
              : "Try again in a moment."
          }
          ctaLabel={hasFilter ? "Clear filter" : "Retry"}
          onPress={hasFilter ? () => setFilter("all") : () => void load()}
          title={hasFilter ? "No nearby matches" : "No nearby catalog results"}
        />
        {diagnostics}
      </>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={{
          gap: spacing[5],
          paddingBottom: spacing[12],
          paddingHorizontal: semanticSpacing.screenEdge,
          paddingTop: spacing[3],
        }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor={palette.orange}
          />
        }
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: palette.bg }}
        testID="catalog-discover-screen"
      >
        <View
          style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}
        >
          <View style={{ gap: spacing[1] }}>
            <AppText variant="h2">Discover</AppText>
            <AppText tone="secondary" variant="micro">
              {totals.dishes.toLocaleString()} dishes · {totals.venues.toLocaleString()} stalls
            </AppText>
            <Pressable
              accessibilityLabel={
                isOfflineCatalog ? "Offline catalog active" : "Live catalog active"
              }
              accessibilityHint={
                FEATURE_FLAGS.catalogDiagnosticsEnabled
                  ? "Long press to open catalog diagnostics"
                  : undefined
              }
              accessibilityRole="button"
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
                style={{ color: isOfflineCatalog ? palette.orange : palette.textSecondary }}
                variant="micro"
              >
                {isOfflineCatalog ? "Offline catalog" : "Live catalog"}
              </AppText>
            </Pressable>
          </View>
          {FEATURE_FLAGS.mapEnabled ? (
            <Pressable
              accessibilityLabel="Open map"
              accessibilityRole="button"
              onPress={() => navigation.navigate("DiscoverMap")}
              style={{
                backgroundColor: palette.bgSoft,
                borderRadius: radii.md,
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
          onPress={() => openBrowse("dishes")}
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
                onPress={() => setFilter(option.id)}
                style={{
                  backgroundColor: active ? palette.orange : palette.bgSoft,
                  borderRadius: radii.pill,
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

        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <Pressable
            accessibilityLabel="Browse stalls and restaurants"
            accessibilityRole="button"
            onPress={() => openBrowse("stalls")}
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
            onPress={() => openBrowse("dishes")}
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

        <View style={{ gap: spacing[3] }}>
          <View
            style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}
          >
            <AppText variant="h3">Nearby dishes</AppText>
            <Pressable
              accessibilityLabel="See all nearby dishes"
              accessibilityRole="button"
              onPress={() => openBrowse("dishes")}
            >
              <AppText style={{ color: palette.orange }} variant="bodyBold">
                See all
              </AppText>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ gap: spacing[3] }}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {dishes.slice(0, 8).map((item) => (
              <RawDishCard key={item.id} item={item} releaseId={releaseId} />
            ))}
          </ScrollView>
        </View>

        <View style={{ gap: spacing[2] }}>
          <View
            style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}
          >
            <AppText variant="h3">Stalls near you</AppText>
            <Pressable
              accessibilityLabel="See all nearby stalls"
              accessibilityRole="button"
              onPress={() => openBrowse("stalls")}
            >
              <AppText style={{ color: palette.orange }} variant="bodyBold">
                See all
              </AppText>
            </Pressable>
          </View>
          {venues.slice(0, 8).map((item) => (
            <RawVenueRow key={item.id} item={item} releaseId={releaseId} />
          ))}
        </View>
      </ScrollView>
      {diagnostics}
    </>
  );
}
