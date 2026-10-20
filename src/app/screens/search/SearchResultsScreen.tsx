import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft, MapPinOff, X } from "lucide-react-native";
import { FlashList } from "@shopify/flash-list";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AccessibleImage,
  AppText,
  Button,
  EmptyState,
  FilterChipRail,
  IconButton,
  Screen,
  Skeleton,
} from "@/components/ui";
import { appendUniqueById } from "@/lib/services/catalog/paging";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import type {
  CatalogPageRequest,
  CatalogRawDishCard,
  CatalogRawVenueCard,
} from "@/lib/services/catalog";
import { CatalogAccessError } from "@/lib/services/catalog";
import {
  recordCatalogDiagnostic,
  summarizeCatalogRequest,
} from "@/lib/services/catalog/diagnostics";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
type SearchResultsRoute = RouteProp<RootStackParamList, "SearchResults">;
// "Open now" and the price cap map onto p_open_only / p_max_price in the catalog RPCs.
const OPEN_NOW_FILTER = "Open now";
const BUDGET_FILTER = "Under S$6";
const BUDGET_MAX_PRICE = 6;
const RAW_BROWSE_FILTER_OPTIONS = [
  "All",
  OPEN_NOW_FILTER,
  BUDGET_FILTER,
  "Halal",
  "Japanese",
  "Western",
  "Noodles",
  "Rice",
].map((filter) => ({ id: filter, label: filter }));

/** Maps a route/link filter or food-type tag onto one of the chips ("Local" was the old open-now chip). */
function resolveInitialFilter(value?: string) {
  if (!value) return undefined;
  if (value.toLowerCase() === "local") return OPEN_NOW_FILTER;
  return RAW_BROWSE_FILTER_OPTIONS.find((option) => option.id.toLowerCase() === value.toLowerCase())
    ?.id;
}

/** "120 m" under a kilometre, "2.4 km" above. */
export function formatBrowseDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

/** ~100 m buckets, so a GPS refresh that barely moves does not reset the list. */
function roundCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
}

function BrowseGridLoadingState({
  itemWidth,
  mode,
}: {
  itemWidth: number;
  mode: "dishes" | "stalls";
}) {
  const { palette, spacing } = useHungryTheme();
  const loadingLabel = mode === "dishes" ? "Preparing dishes" : "Preparing stalls";

  return (
    <View accessibilityLabel={loadingLabel} accessibilityRole="progressbar">
      <View style={{ alignItems: "center", gap: spacing[2], paddingVertical: spacing[5] }}>
        <ActivityIndicator color={palette.orange} />
        <AppText tone="secondary">{loadingLabel}…</AppText>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {Array.from({ length: 8 }).map((_, index) => (
          <View
            key={`browse-grid-skeleton-${index}`}
            style={{
              height: itemWidth * 1.35,
              padding: spacing[1],
              width: itemWidth,
            }}
          >
            <Skeleton width="100%" height="100%" borderRadius={0} />
          </View>
        ))}
      </View>
    </View>
  );
}

type RawCatalogItem = CatalogRawDishCard | CatalogRawVenueCard;

function rawCatalogRequest(
  mode: "dishes" | "stalls",
  query: string,
  selectedFilter: string,
  coordinate: { latitude: number; longitude: number },
  cursor?: string,
): CatalogPageRequest {
  const filter = selectedFilter.toLowerCase();
  return {
    query: query.trim() || undefined,
    coordinate,
    radiusMeters: query.trim() ? undefined : 3_000,
    cursor,
    limit: 24,
    sort: query.trim() ? "relevance" : "nearby",
    dietaryFlags: filter === "halal" ? ["halal"] : [],
    cuisineTags: ["japanese", "western", "noodles", "rice"].includes(filter) ? [filter] : [],
    openOnly: selectedFilter === OPEN_NOW_FILTER,
    maxPrice: selectedFilter === BUDGET_FILTER ? BUDGET_MAX_PRICE : undefined,
  };
}

const RawCatalogCard = memo(function RawCatalogCard({
  item,
  itemWidth,
  mode,
  onPress,
}: {
  item: RawCatalogItem;
  itemWidth: number;
  mode: "dishes" | "stalls";
  onPress: () => void;
}) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const isDish = mode === "dishes";
  const imageUrl =
    item.imageUrl ?? ("representativeDish" in item ? item.representativeDish?.imageUrl : undefined);
  const title = isDish ? (item as CatalogRawDishCard).name : (item as CatalogRawVenueCard).name;
  const subtitle = isDish
    ? (item as CatalogRawDishCard).venueName
    : ((item as CatalogRawVenueCard).representativeDish?.name ?? "Menu details available");
  const price = isDish ? (item as CatalogRawDishCard).price : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
      onPress={onPress}
      style={{ padding: spacing[1], width: itemWidth }}
    >
      <View
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          minHeight: itemWidth * 1.25,
          overflow: "hidden",
        }}
      >
        <View style={{ backgroundColor: palette.bgSoft, height: itemWidth * 0.7 }}>
          {imageUrl ? (
            <AccessibleImage
              source={{ uri: imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessibilityLabel={`${title} image`}
            />
          ) : (
            <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
              <AppText tone="muted" variant="micro">
                Image unavailable
              </AppText>
            </View>
          )}
          {/* Only positive verification is badged; most catalog rows are unverified. */}
          {item.verificationStatus === "verified" || item.verificationStatus === "approved" ? (
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
              <AppText variant="micro" style={{ color: palette.textSecondary }}>
                {item.verificationStatus === "approved" ? "Verified" : "Source verified"}
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={{ gap: spacing[1], padding: spacing[2] }}>
          <AppText numberOfLines={2} variant="bodyBold">
            {title}
          </AppText>
          <AppText numberOfLines={1} tone="secondary" variant="micro">
            {subtitle}
          </AppText>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <AppText tone="muted" variant="micro">
              {item.distanceMeters !== undefined
                ? formatBrowseDistance(item.distanceMeters)
                : "Singapore"}
            </AppText>
            {price !== undefined ? (
              <AppText style={{ color: palette.orange }} variant="price">
                S${price.toFixed(2)}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
});

function RawCatalogBrowseGrid({
  initialFilter,
  initialSearchQuery = "",
  mode,
}: {
  initialFilter?: string;
  initialSearchQuery?: string;
  mode: "dishes" | "stalls";
}) {
  const navigation = useNavigation<RootNavigation>();
  const { palette, spacing } = useHungryTheme();
  const { width } = useWindowDimensions();
  const permission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const recordTasteInteraction = useProfileStore((state) => state.recordTasteInteraction);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const lastRecordedQueryRef = useRef("");
  const [selectedFilter, setSelectedFilter] = useState(
    () => resolveInitialFilter(initialFilter) ?? "All",
  );
  const [items, setItems] = useState<RawCatalogItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [releaseId, setReleaseId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A failed next page waits for a tap on Retry instead of re-firing on every scroll.
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const requestVersion = useRef(0);
  const rawSearchInputRef = useRef<TextInput | null>(null);
  const releaseIdRef = useRef<string | undefined>(undefined);
  const service = getCatalogRawService();
  const itemWidth = width / 2;

  // A link or a new navigation with other params replaces what the grid shows.
  useEffect(() => {
    setSearchQuery(initialSearchQuery);
  }, [initialSearchQuery]);
  useEffect(() => {
    setSelectedFilter(resolveInitialFilter(initialFilter) ?? "All");
  }, [initialFilter]);

  // A picked area wins over GPS; without either the default point is used and disclosed below.
  const { coordinate: effectiveCoordinate, isApproximate: isUsingDefaultLocation } =
    getEffectiveLocation({ permission, currentLocation, manualCoordinate });
  const latitude = roundCoordinate(effectiveCoordinate.latitude);
  const longitude = roundCoordinate(effectiveCoordinate.longitude);
  const coordinate = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);

  const loadPage = useCallback(
    async (cursor?: string, append = false) => {
      if (!isAuthenticated) return;
      const startedAt = Date.now();
      const version = requestVersion.current;
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setError(null);
      setLoadMoreFailed(false);
      try {
        const request = rawCatalogRequest(mode, searchQuery, selectedFilter, coordinate, cursor);
        request.releaseId = cursor ? releaseIdRef.current : undefined;
        const page =
          mode === "dishes" ? await service.listDishes(request) : await service.listVenues(request);
        if (requestVersion.current !== version) return;
        // Defensive dedupe: FlashList keys must stay unique even if a source
        // repeats a row across pages.
        setItems((current) => (append ? appendUniqueById(current, page.items) : page.items));
        setNextCursor(page.nextCursor);
        releaseIdRef.current = page.releaseId || undefined;
        setReleaseId(releaseIdRef.current);
        recordCatalogDiagnostic({
          operation:
            mode === "dishes"
              ? searchQuery.trim()
                ? "search-dishes"
                : "browse-dishes"
              : searchQuery.trim()
                ? "search-stalls"
                : "browse-stalls",
          durationMs: Date.now() - startedAt,
          releaseId: page.releaseId,
          request: summarizeCatalogRequest(request),
          resultCount: page.items.length,
          succeeded: true,
        });
        if (append) {
          trackAnalyticsEvent("search_load_more", { mode, count: page.items.length });
        } else if (page.items.length === 0) {
          trackAnalyticsEvent("search_zero_results", {
            mode,
            filter: selectedFilter,
            query_length: searchQuery.trim().length,
          });
        }
      } catch (loadError) {
        if (requestVersion.current === version) {
          reportError(loadError, { surface: "catalog_browse", mode });
          if (append) {
            setLoadMoreFailed(true);
          } else {
            setError(
              loadError instanceof Error ? loadError.message : "Could not load the catalog.",
            );
            setItems([]);
          }
          const request = rawCatalogRequest(
            mode,
            searchQuery,
            selectedFilter,
            currentLocation,
            cursor,
          );
          recordCatalogDiagnostic({
            operation:
              mode === "dishes"
                ? searchQuery.trim()
                  ? "search-dishes"
                  : "browse-dishes"
                : searchQuery.trim()
                  ? "search-stalls"
                  : "browse-stalls",
            durationMs: Date.now() - startedAt,
            errorKind:
              loadError instanceof CatalogAccessError
                ? loadError.kind
                : loadError instanceof Error
                  ? loadError.name
                  : "unknown",
            request: summarizeCatalogRequest(request),
            resultCount: 0,
            succeeded: false,
          });
        }
      } finally {
        if (requestVersion.current === version) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [coordinate, mode, searchQuery, selectedFilter, service],
  );

  // Only a submitted query is a committed search: one taste signal each, not one per typing pause.
  const recordCommittedQuery = useCallback(
    (query: string) => {
      const committedQuery = query.trim().toLowerCase();
      if (!committedQuery || lastRecordedQueryRef.current === committedQuery) return;
      lastRecordedQueryRef.current = committedQuery;
      trackAnalyticsEvent("search_query", {
        mode,
        filter: selectedFilter,
        query_length: committedQuery.length,
      });
      recordTasteInteraction({
        type: "search_query",
        surface: "search",
        query: committedQuery,
        chipId: selectedFilter === "All" ? undefined : selectedFilter,
      });
    },
    [mode, recordTasteInteraction, selectedFilter],
  );

  // A query sent from Search home was already submitted there.
  const initialQueryRecordedRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || initialQueryRecordedRef.current) return;
    initialQueryRecordedRef.current = true;
    recordCommittedQuery(initialSearchQuery);
  }, [initialSearchQuery, isAuthenticated, recordCommittedQuery]);

  useEffect(() => {
    requestVersion.current += 1;
    releaseIdRef.current = undefined;
    setReleaseId(undefined);
    const timer = setTimeout(
      () => {
        void loadPage();
      },
      searchQuery.trim() ? 250 : 0,
    );
    return () => clearTimeout(timer);
  }, [loadPage]);

  const handleSelectFilter = useCallback(
    (filter: string) => {
      setSelectedFilter(filter);
      trackAnalyticsEvent("search_filter_changed", { mode, filter });
    },
    [mode],
  );

  const handleBack = useCallback(() => {
    // Cold starts and links have nothing to go back to.
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("MainTabs", { screen: "Discover" });
  }, [navigation]);

  const renderItem = useCallback(
    ({ item, index }: { item: RawCatalogItem; index: number }) => (
      <RawCatalogCard
        item={item}
        itemWidth={itemWidth}
        mode={mode}
        onPress={() => {
          navigation.navigate("CatalogRawDetail", {
            kind: mode === "dishes" ? "dish" : "venue",
            id: item.id,
            releaseId,
          });
          trackAnalyticsEvent("search_result_opened", { mode, position: index });
          if (mode === "dishes") {
            recordTasteInteraction({
              type: "dish_result_click",
              surface: "search",
              dishId: item.id,
              query: searchQuery.trim() || undefined,
              buttonId: "search_result",
            });
          }
        }}
      />
    ),
    [itemWidth, mode, navigation, recordTasteInteraction, releaseId, searchQuery],
  );

  return (
    <Screen scroll={false} fullWidth style={{ backgroundColor: palette.bg }}>
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <View
          style={{ gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3] }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
            <IconButton
              variant="ghost"
              accessibilityLabel="Go back"
              onPress={handleBack}
              icon={<ArrowLeft color={palette.text} size={22} />}
            />
            <View style={{ flex: 1, justifyContent: "center" }}>
              <TextInput
                ref={rawSearchInputRef}
                accessibilityLabel={`Search ${mode}`}
                autoCorrect={false}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => recordCommittedQuery(searchQuery)}
                placeholder={mode === "dishes" ? "Search all dishes" : "Search all stalls"}
                placeholderTextColor={palette.textMuted}
                returnKeyType="search"
                testID="browse-results-search-input"
                style={[
                  browseStyles.textInput,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: 18,
                    borderWidth: 1,
                    color: palette.text,
                    height: 48,
                    paddingLeft: spacing[3],
                    paddingRight: searchQuery ? 48 : spacing[3],
                  },
                ]}
                value={searchQuery}
              />
              {searchQuery ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  hitSlop={8}
                  onPress={() => {
                    setSearchQuery("");
                    rawSearchInputRef.current?.focus();
                  }}
                  style={browseStyles.clearButton}
                >
                  <X color={palette.textMuted} size={18} />
                </Pressable>
              ) : null}
            </View>
          </View>
          <FilterChipRail
            options={RAW_BROWSE_FILTER_OPTIONS}
            selectedId={selectedFilter}
            onSelect={handleSelectFilter}
          />
          {isUsingDefaultLocation ? (
            <View
              accessibilityRole="text"
              style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}
            >
              <MapPinOff color={palette.textMuted} size={16} />
              <AppText tone="secondary" variant="micro" style={{ flex: 1 }}>
                Location is off, so distances are from central Singapore.
              </AppText>
            </View>
          ) : null}
        </View>
        <FlashList
          data={items}
          // @ts-ignore FlashList v2 supports this runtime prop but its bundled type omits it.
          estimatedItemSize={itemWidth * 1.25}
          extraData={releaseId}
          keyExtractor={(item) => item.id}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          numColumns={2}
          onEndReached={() => {
            if (nextCursor && !isLoadingMore && !isLoading && !loadMoreFailed) {
              void loadPage(nextCursor, true);
            }
          }}
          onEndReachedThreshold={0.6}
          renderItem={renderItem}
          ListEmptyComponent={
            isLoading ? (
              <BrowseGridLoadingState itemWidth={itemWidth} mode={mode} />
            ) : error ? (
              <EmptyState
                title="Catalog unavailable"
                body="We couldn't load the catalog. Check your connection and try again."
                errorMessage={error}
                ctaLabel="Retry"
                onPress={() => void loadPage()}
              />
            ) : (
              <EmptyState title="No matches found" body="Try another search or filter." />
            )
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={{ paddingVertical: spacing[4] }}>
                <ActivityIndicator color={palette.orange} />
              </View>
            ) : loadMoreFailed && nextCursor ? (
              <View style={{ alignItems: "center", gap: spacing[2], paddingVertical: spacing[4] }}>
                <AppText tone="secondary">{"Couldn't load more."}</AppText>
                <Button
                  label="Retry"
                  variant="secondary"
                  onPress={() => void loadPage(nextCursor, true)}
                />
              </View>
            ) : null
          }
        />
      </View>
    </Screen>
  );
}

const browseStyles = StyleSheet.create({
  clearButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 2,
    width: 44,
  },
  textInput: {
    fontSize: 16,
    padding: 0,
    textAlignVertical: "center",
  },
});

export function BrowseDishesScreen() {
  return <RawCatalogBrowseGrid mode="dishes" />;
}

export function BrowseStallsScreen() {
  return <RawCatalogBrowseGrid mode="stalls" />;
}

export function SearchResultsScreen() {
  const route = useRoute<SearchResultsRoute>();

  // Everything comes from route params, so a search never inherits an older persisted query.
  return (
    <RawCatalogBrowseGrid
      mode={route.params?.browseMode ?? "dishes"}
      initialFilter={route.params?.initialFilter ?? route.params?.foodTypeTag}
      initialSearchQuery={route.params?.initialQuery ?? ""}
    />
  );
}
