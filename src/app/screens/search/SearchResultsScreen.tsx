import { useCallback, useEffect, useRef, useState } from "react";
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
import { ArrowLeft, X } from "lucide-react-native";
import { FlashList } from "@shopify/flash-list";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AccessibleImage,
  AppHeader,
  AppText,
  Button,
  EmptyState,
  FilterChipRail,
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
import { reportError } from "@/lib/monitoring/reportError";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
type SearchResultsRoute = RouteProp<RootStackParamList, "SearchResults">;
const RAW_BROWSE_FILTER_OPTIONS = ["All", "Halal", "Japanese", "Western", "Noodles", "Rice"].map(
  (filter) => ({ id: filter, label: filter }),
);

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
    openOnly: mode === "stalls" && filter === "local",
  };
}

function RawCatalogCard({
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
              <AppText variant="micro" style={{ color: palette.textMuted, fontSize: 10 }}>
                {item.verificationStatus === "verified" ? "Source verified" : "Unverified"}
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
                ? `${Math.round(item.distanceMeters)} m`
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
}

function RawCatalogBrowseGrid({
  initialFoodTypeTag,
  initialSearchQuery = "",
  mode,
}: {
  initialFoodTypeTag?: string;
  initialSearchQuery?: string;
  mode: "dishes" | "stalls";
}) {
  const navigation = useNavigation<RootNavigation>();
  const { palette, spacing } = useHungryTheme();
  const { width } = useWindowDimensions();
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const recordTasteInteraction = useProfileStore((state) => state.recordTasteInteraction);
  const route = useRoute();
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const lastRecordedQueryRef = useRef("");
  const initialRawFilter = RAW_BROWSE_FILTER_OPTIONS.find(
    (option) => option.id.toLowerCase() === initialFoodTypeTag?.toLowerCase(),
  )?.id;
  const [selectedFilter, setSelectedFilter] = useState(initialRawFilter ?? "All");
  const [items, setItems] = useState<RawCatalogItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [releaseId, setReleaseId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const rawSearchInputRef = useRef<TextInput | null>(null);
  const releaseIdRef = useRef<string | undefined>(undefined);
  const service = getCatalogRawService();
  const itemWidth = width / 2;

  const loadPage = useCallback(
    async (cursor?: string, append = false) => {
      if (!isAuthenticated) return;
      const startedAt = Date.now();
      const version = requestVersion.current;
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setError(null);
      setLoadMoreError(null);
      try {
        const request = rawCatalogRequest(
          mode,
          searchQuery,
          selectedFilter,
          currentLocation,
          cursor,
        );
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
      } catch (loadError) {
        if (requestVersion.current === version) {
          reportError(loadError, { surface: "catalog_browse", mode });
          const message =
            loadError instanceof Error ? loadError.message : "Could not load the catalog.";
          // A failed continuation keeps the rows already shown (same source) and
          // offers a retry for the same cursor instead of switching source.
          if (append) setLoadMoreError(message);
          else {
            setError(message);
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
    [currentLocation, isAuthenticated, mode, searchQuery, selectedFilter, service],
  );

  // Only a submitted query is a committed search: one taste signal each, not one per typing pause.
  const recordCommittedQuery = useCallback(
    (query: string) => {
      const committedQuery = query.trim().toLowerCase();
      if (!committedQuery || lastRecordedQueryRef.current === committedQuery) return;
      lastRecordedQueryRef.current = committedQuery;
      recordTasteInteraction({
        type: "search_query",
        surface: "search",
        query: committedQuery,
        chipId: selectedFilter === "All" ? undefined : selectedFilter,
      });
    },
    [recordTasteInteraction, selectedFilter],
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

  if (!isAuthenticated) {
    return (
      <Screen scroll={false}>
        <AppHeader title={mode === "dishes" ? "Dishes" : "Stalls"} />
        <EmptyState
          title="Sign in to browse the full directory"
          body="The complete Hungry catalog is available after you sign in."
          ctaLabel="Sign in"
          onPress={() => {
            // Bring the guest back to this same page after signing in.
            setReturnRoute({
              name: route.name,
              params: route.params as Record<string, unknown> | undefined,
            });
            navigation.navigate("AuthStack", { screen: "Login" });
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} fullWidth style={{ backgroundColor: palette.bg }}>
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <View
          style={{ gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3] }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => navigation.goBack()}
            >
              <ArrowLeft color={palette.text} size={24} />
            </Pressable>
            <View style={{ flex: 1, height: 48, justifyContent: "center" }}>
              <TextInput
                ref={rawSearchInputRef}
                accessibilityLabel={`Search ${mode}`}
                autoCorrect={false}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => recordCommittedQuery(searchQuery)}
                placeholder={mode === "dishes" ? "Search all dishes" : "Search all stalls"}
                placeholderTextColor={palette.textMuted}
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
                    paddingRight: spacing[3] + 28,
                  },
                ]}
                value={searchQuery}
              />
              {searchQuery.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  hitSlop={12}
                  onPress={() => {
                    setSearchQuery("");
                    rawSearchInputRef.current?.focus();
                  }}
                  style={{ position: "absolute", right: spacing[3] }}
                >
                  <X color={palette.textMuted} size={20} />
                </Pressable>
              ) : null}
            </View>
          </View>
          <FilterChipRail
            options={RAW_BROWSE_FILTER_OPTIONS}
            selectedId={selectedFilter}
            onSelect={setSelectedFilter}
          />
        </View>
        <FlashList
          data={items}
          keyboardShouldPersistTaps="handled"
          // @ts-ignore FlashList v2 supports this runtime prop but its bundled type omits it.
          estimatedItemSize={itemWidth * 1.25}
          keyExtractor={(item) => item.id}
          numColumns={2}
          onEndReached={() => {
            if (nextCursor && !isLoadingMore && !isLoading && !loadMoreError) {
              void loadPage(nextCursor, true);
            }
          }}
          onEndReachedThreshold={0.6}
          renderItem={({ item }) => (
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
          )}
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
            ) : loadMoreError && nextCursor ? (
              <View
                accessibilityLiveRegion="polite"
                style={{ alignItems: "center", gap: spacing[2], paddingVertical: spacing[4] }}
              >
                <AppText tone="secondary" variant="bodySmall">
                  {"Couldn't load more results."}
                </AppText>
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
  textInput: {
    flex: 1,
    fontSize: 16,
    height: "100%",
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
  const storedQuery = useSearchStore((state) => state.filters.query);
  const selectedCategories = useSearchStore((state) => state.filters.categories);
  const storedCatalogCategory = selectedCategories.find((category) =>
    ["noodles", "rice"].includes(category),
  );

  return (
    <RawCatalogBrowseGrid
      mode={route.params?.browseMode ?? "dishes"}
      initialFoodTypeTag={route.params?.foodTypeTag ?? storedCatalogCategory}
      initialSearchQuery={route.params?.initialQuery ?? storedQuery}
    />
  );
}
