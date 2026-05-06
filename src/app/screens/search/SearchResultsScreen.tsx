import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft, Heart, MapPinned, Search, X } from "lucide-react-native";
import { FlashList } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Avatar, Chip, Screen } from "@/components/ui";
import { SearchResultsView } from "@/components/discover/SearchResultsView";
import { getNearestBuildings } from "@/lib/geo/singaporeBuildings";
import {
  getSearchResults,
  sortSearchResults,
  type SearchSortMode,
  useSearchData,
} from "@/features/search/search";
import { dataRepositoryMock as fallbackBrowseRepository } from "@/lib/services/mock/repositories";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useLocationStore } from "@/store/useLocationStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail, VenueSummary } from "@/types/domain";

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
type SearchResultsRoute = RouteProp<RootStackParamList, "SearchResults">;
type BrowseFeedItem = {
  id: string;
  title: string;
  venueName: string;
  imageUrl: string;
  authorName: string;
  authorAvatarUrl: string;
  distanceMeters: number;
  likeCount: number;
  dish: DishDetail;
  venue?: VenueSummary;
};

const BROWSE_FILTERS = ["All", "Local", "Halal", "Japanese", "Western", "Noodles", "Rice", "Spicy"];

function BrowseGridScreen({
  mode,
  initialSearchQuery = "",
}: {
  mode: "dishes" | "stalls";
  initialSearchQuery?: string;
}) {
  const navigation = useNavigation<RootNavigation>();
  const { palette, radii, spacing } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchLauncherLeft, setSearchLauncherLeft] = useState(0);
  const [backControlLimit, setBackControlLimit] = useState(spacing[4] + 32);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const searchInputRef = useRef<TextInput | null>(null);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const repository = getDataRepository();
  const getBrowseDishesByVenue = useCallback(
    (venueId: string) => {
      const primaryDishes = repository.listDishesByVenue(venueId);
      return primaryDishes.length
        ? primaryDishes
        : fallbackBrowseRepository.listDishesByVenue(venueId);
    },
    [repository],
  );
  const getBrowseDishById = useCallback(
    (dishId: string) =>
      repository.getDishById(dishId) ?? fallbackBrowseRepository.getDishById(dishId),
    [repository],
  );
  const areaBuildings = useMemo(
    () => getNearestBuildings(currentLocation.latitude, currentLocation.longitude, 3, 14),
    [currentLocation.latitude, currentLocation.longitude],
  );
  const fallbackAllVenues = useMemo(
    () =>
      fallbackBrowseRepository
        .listBuildings()
        .flatMap((building) => fallbackBrowseRepository.listVenuesByBuilding(building.id)),
    [],
  );
  const allVenues = useMemo(() => {
    const repositoryVenues = repository
      .listBuildings()
      .flatMap((building) => repository.listVenuesByBuilding(building.id));
    return repositoryVenues.length ? repositoryVenues : fallbackAllVenues;
  }, [fallbackAllVenues, repository]);
  const areaVenues = useMemo(() => {
    const scopedVenues = areaBuildings.flatMap((building) =>
      repository.listVenuesByBuilding(building.id),
    );
    const uniqueVenues = new Map(scopedVenues.map((venue) => [venue.id, venue]));
    return uniqueVenues.size ? Array.from(uniqueVenues.values()) : allVenues;
  }, [allVenues, areaBuildings, repository]);
  const allDishes = useMemo(
    () => allVenues.flatMap((venue) => getBrowseDishesByVenue(venue.id)),
    [allVenues, getBrowseDishesByVenue],
  );
  const browseDishes = useMemo(() => {
    const scopedDishes = areaVenues
      .flatMap((venue) => getBrowseDishesByVenue(venue.id))
      .sort((left, right) => right.rating - left.rating);
    return scopedDishes.length
      ? scopedDishes
      : [...allDishes].sort((left, right) => right.rating - left.rating);
  }, [allDishes, areaVenues, getBrowseDishesByVenue]);
  const browseVenues = useMemo(
    () =>
      (areaVenues.length ? areaVenues : allVenues).map((venue) => {
        const dishes = getBrowseDishesByVenue(venue.id).sort(
          (left, right) => right.rating - left.rating,
        );
        const topDish = dishes[0] ?? getBrowseDishById(venue.topDishId);

        return {
          venue,
          dishes,
          topDish,
          minDistanceMeters: topDish?.distanceMeters ?? 0,
        };
      }),
    [allVenues, areaVenues, getBrowseDishById, getBrowseDishesByVenue],
  );

  const isDishGrid = mode === "dishes";
  const stallPosts = useMemo(() => repository.listStallPosts(), [repository]);
  const feedItems = useMemo<BrowseFeedItem[]>(() => {
    const postFallback = stallPosts[0];

    if (isDishGrid) {
      return browseDishes.map((dish, index) => {
        const post =
          stallPosts.find((candidate) => candidate.dishIds.includes(dish.id)) ??
          stallPosts.find((candidate) => candidate.venueId === dish.venueId) ??
          postFallback;

        return {
          id: `dish-${dish.id}`,
          title: dish.name,
          venueName: dish.venueName,
          imageUrl: dish.imageUrl,
          authorName: post?.authorName ?? "Hungry Guide",
          authorAvatarUrl: post?.authorAvatarUrl ?? dish.imageUrl,
          distanceMeters: dish.distanceMeters,
          likeCount: dish.reviewCount + index * 17,
          dish,
        };
      });
    }

    const buildStallItems = (
      venues: {
        topDish?: DishDetail;
        venue: VenueSummary;
        dishes: DishDetail[];
      }[],
    ) =>
      venues.flatMap(({ venue, topDish, dishes }, index) => {
        const matchedDish = normalizedQuery
          ? dishes.find((dish) => dish.name.toLowerCase().includes(normalizedQuery))
          : topDish;

        if (!matchedDish) {
          return [];
        }

        const dishToShow = matchedDish;

        const post =
          stallPosts.find((candidate) => candidate.venueId === venue.id) ??
          stallPosts.find((candidate) => candidate.dishIds.includes(dishToShow.id)) ??
          postFallback;

        return {
          id: `stall-${venue.id}`,
          title: dishToShow.name,
          venueName: venue.name,
          imageUrl: dishToShow.imageUrl,
          authorName: post?.authorName ?? "Hungry Guide",
          authorAvatarUrl: post?.authorAvatarUrl ?? dishToShow.imageUrl,
          distanceMeters: dishToShow.distanceMeters,
          likeCount: dishToShow.reviewCount + index * 23,
          dish: dishToShow,
          venue,
        };
      });

    const stallItems = buildStallItems(browseVenues);
    if (stallItems.length) {
      return stallItems;
    }

    return buildStallItems(
      fallbackAllVenues.map((venue) => {
        const dishes = fallbackBrowseRepository
          .listDishesByVenue(venue.id)
          .sort((left, right) => right.rating - left.rating);

        return {
          venue,
          dishes,
          topDish: dishes[0] ?? fallbackBrowseRepository.getDishById(venue.topDishId),
        };
      }),
    );
  }, [browseDishes, browseVenues, fallbackAllVenues, isDishGrid, normalizedQuery, stallPosts]);
  const filteredFeedItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filter = selectedFilter.toLowerCase();
    const filtered = feedItems.filter((item) => {
      const searchText = [
        item.title,
        item.venueName,
        item.authorName,
        item.dish.name,
        item.dish.tasteTags.join(" "),
        item.dish.dietaryFlags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !query || searchText.includes(query);
      const matchesFilter =
        filter === "all" ||
        searchText.includes(filter) ||
        (filter === "local" && searchText.includes("singapore")) ||
        (filter === "spicy" && item.dish.tasteVector.spicy >= 6);

      return matchesSearch && matchesFilter;
    });

    return filtered.length || query ? filtered : feedItems;
  }, [feedItems, searchQuery, selectedFilter]);
  const numColumns = 2;
  const itemWidth = screenWidth / numColumns;
  const browseTitle = isDishGrid ? "Dishes" : "Stalls & Restaurants";
  const searchPlaceholder = isDishGrid ? "Find dishes..." : "Find stalls...";
  const searchBarWidth = Math.max(screenWidth - spacing[4] * 2, 240);
  const searchIconSize = 56;
  const fallbackLauncherLeft = screenWidth - spacing[4] - searchIconSize;
  const searchRevealProgress = useRef(new Animated.Value(0)).current;
  const searchPanelWidth = useMemo(() => {
    const effectiveLauncherLeft = searchLauncherLeft || fallbackLauncherLeft;
    const maximumFromLeadingEdge = effectiveLauncherLeft + searchIconSize - backControlLimit;
    return Math.max(180, Math.min(searchBarWidth, maximumFromLeadingEdge));
  }, [fallbackLauncherLeft, searchBarWidth, searchIconSize, searchLauncherLeft, backControlLimit]);
  const searchEntryAnimWidth = searchRevealProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, searchPanelWidth],
    extrapolate: "clamp",
  });
  const searchInputOpacity = searchRevealProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const searchInputScale = searchRevealProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
    extrapolate: "clamp",
  });
  const revealSearch = () => {
    if (isSearchExpanded) {
      return;
    }

    setIsSearchExpanded(true);
    searchRevealProgress.stopAnimation();
    searchRevealProgress.setValue(0);
    Animated.timing(searchRevealProgress, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      searchInputRef.current?.focus();
    });
  };
  const hideSearch = () => {
    if (!isSearchExpanded) {
      return;
    }

    searchRevealProgress.stopAnimation(() =>
      Animated.timing(searchRevealProgress, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        setIsSearchExpanded(false);
        searchInputRef.current?.blur();
      }),
    );
  };
  useEffect(() => {
    return () => {
      searchRevealProgress.stopAnimation();
      searchRevealProgress.setValue(0);
    };
  }, [searchRevealProgress]);

  const renderBrowseItem = useCallback(
    ({ item }: { item: BrowseFeedItem }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.title}`}
        onPress={() => {
          if (item.venue?.id) {
            navigation.navigate("StallDetail", { venueId: item.venue.id });
            return;
          }

          navigation.navigate("DishDetail", { dishId: item.dish.id });
        }}
        style={{
          backgroundColor: palette.surface,
          borderBottomColor: palette.border,
          borderBottomWidth: 0.5,
          borderRightColor: palette.border,
          borderRightWidth: 0.5,
          height: itemWidth * 1.35,
          width: itemWidth,
        }}
      >
        <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.82)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={browseStyles.cardContent}>
          <View style={browseStyles.authorBadge}>
            <Avatar uri={item.authorAvatarUrl} name={item.authorName} size={18} />
            <AppText
              variant="micro"
              style={{ color: palette.white, fontSize: 10, fontWeight: "700" }}
              numberOfLines={1}
            >
              {item.authorName}
            </AppText>
          </View>
          <View style={{ flex: 1 }} />
          <AppText
            variant="bodySmallBold"
            style={{ color: palette.white, marginBottom: 2 }}
            numberOfLines={1}
          >
            {item.title}
          </AppText>
          <View style={browseStyles.metaRow}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 2 }}>
              <MapPinned color={palette.white} size={10} />
              <AppText
                variant="micro"
                style={{ color: palette.white, fontSize: 10, fontWeight: "600" }}
              >
                {Math.round(item.distanceMeters)}m
              </AppText>
            </View>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 3 }}>
              <Heart
                color={palette.white}
                fill={palette.white}
                size={10}
                style={{ opacity: 0.82 }}
              />
              <AppText
                variant="micro"
                style={{ color: palette.white, fontSize: 10, fontWeight: "700" }}
              >
                {item.likeCount}
              </AppText>
            </View>
          </View>
        </View>
      </Pressable>
    ),
    [itemWidth, navigation, palette],
  );

  return (
    <Screen scroll={false} fullWidth style={{ backgroundColor: palette.bg }}>
      <View style={{ flex: 1, backgroundColor: palette.bg, position: "relative" }}>
        {isSearchExpanded ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss search"
            onPress={hideSearch}
            style={browseStyles.searchDismissOverlay}
          />
        ) : null}
        <View
          style={{
            backgroundColor: palette.bg,
            borderBottomColor: palette.border,
            borderBottomWidth: 1,
            paddingBottom: spacing[2],
            paddingTop: spacing[2],
            zIndex: 40,
          }}
        >
          <View style={[browseStyles.titleRow, { paddingHorizontal: spacing[4] }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              onPress={() => navigation.goBack()}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                setBackControlLimit(x + width);
              }}
              style={browseStyles.backButton}
            >
              <ArrowLeft color={palette.text} size={24} />
            </Pressable>
            <AppText
              variant="h1"
              numberOfLines={1}
              style={{ color: palette.text, flex: 1, fontSize: 24, lineHeight: 30 }}
            >
              {browseTitle}
            </AppText>
            <View
              style={[browseStyles.inlineSearchLauncher, { width: searchIconSize }]}
              onLayout={(event) => {
                setSearchLauncherLeft(event.nativeEvent.layout.x);
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Search"
                hitSlop={12}
                onPress={isSearchExpanded ? hideSearch : revealSearch}
                style={{
                  width: searchIconSize,
                  height: 56,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Search color={palette.textMuted} size={20} />
              </Pressable>

              {isSearchExpanded ? (
                <Animated.View
                  pointerEvents="auto"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    height: 56,
                    borderRadius: radii.pill,
                    overflow: "hidden",
                    width: searchEntryAnimWidth,
                    backgroundColor: palette.surface,
                    borderWidth: 1,
                    borderColor: palette.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing[2],
                    paddingHorizontal: spacing[3],
                  }}
                >
                  <Animated.View
                    style={{
                      flex: 1,
                      opacity: searchInputOpacity,
                      transform: [{ scale: searchInputScale }],
                    }}
                  >
                    <TextInput
                      ref={searchInputRef}
                      autoCorrect={false}
                      onBlur={hideSearch}
                      onChangeText={setSearchQuery}
                      placeholder={searchPlaceholder}
                      placeholderTextColor={palette.textMuted}
                      style={[
                        browseStyles.textInput,
                        { color: palette.text, textAlignVertical: "center" },
                      ]}
                      value={searchQuery}
                    />
                  </Animated.View>
                  <Animated.View style={{ opacity: searchInputOpacity }}>
                    {searchQuery.length > 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Clear browse search"
                        hitSlop={8}
                        onPress={() => setSearchQuery("")}
                      >
                        <X color={palette.textMuted} size={18} />
                      </Pressable>
                    ) : null}
                  </Animated.View>
                </Animated.View>
              ) : null}
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: spacing[2], marginBottom: spacing[2] }}
            contentContainerStyle={{ gap: spacing[2], paddingLeft: spacing[4] }}
          >
            {BROWSE_FILTERS.map((filter) => (
              <Chip
                key={filter}
                label={filter}
                selected={selectedFilter === filter}
                onPress={() => setSelectedFilter(filter)}
              />
            ))}
          </ScrollView>
        </View>

        <FlashList
          data={filteredFeedItems}
          renderItem={renderBrowseItem}
          keyExtractor={(item) => item.id}
          // @ts-ignore FlashList v2 runtime supports this prop but its bundled RN type omits it.
          estimatedItemSize={220}
          numColumns={numColumns}
          contentContainerStyle={{ paddingBottom: spacing[12] }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View
              style={{
                alignItems: "center",
                gap: spacing[2],
                paddingHorizontal: spacing[8],
                paddingTop: spacing[12],
              }}
            >
              <AppText variant="h3" style={{ textAlign: "center" }}>
                No matches found
              </AppText>
              <AppText tone="muted" style={{ textAlign: "center" }}>
                Try another search or filter.
              </AppText>
            </View>
          }
        />
      </View>
    </Screen>
  );
}

const browseStyles = StyleSheet.create({
  authorBadge: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    left: 8,
    padding: 4,
    paddingRight: 8,
    position: "absolute",
    top: 8,
  },
  backButton: { alignItems: "center", height: 40, justifyContent: "center", width: 32 },
  cardContent: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", padding: 10 },
  metaRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  searchRow: { alignItems: "center", flexDirection: "row", gap: 12, zIndex: 30 },
  titleRow: { alignItems: "center", flexDirection: "row", gap: 12, marginBottom: 10 },
  inlineSearchLauncher: {
    alignItems: "center",
    position: "relative",
    height: 56,
    overflow: "visible",
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    height: "100%",
    padding: 0,
    textAlignVertical: "center",
  },
  searchDismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    zIndex: 20,
  },
});

export function BrowseDishesScreen() {
  return <BrowseGridScreen mode="dishes" />;
}

export function BrowseStallsScreen() {
  return <BrowseGridScreen mode="stalls" />;
}

export function SearchResultsScreen() {
  const route = useRoute<SearchResultsRoute>();
  const navigation = useNavigation<RootNavigation>();
  const { profile, filters } = useSearchData();
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const updateQuery = useSearchStore((state) => state.updateQuery);
  const sortMode: SearchSortMode = "best_match";
  const browseMode = route.params?.browseMode;
  const initialQuery = route.params?.initialQuery ?? "";
  const rawResults = useMemo(
    () => getSearchResults(filters, profile.tasteVector),
    [filters, profile.tasteVector],
  );
  const results = useMemo(
    () => sortSearchResults(rawResults, sortMode, profile.tasteVector),
    [profile.tasteVector, rawResults, sortMode],
  );

  if (browseMode) {
    return <BrowseGridScreen mode={browseMode} initialSearchQuery={initialQuery} />;
  }

  return (
    <Screen scroll={false}>
      <SearchResultsView
        query={filters.query}
        onQueryChange={updateQuery}
        onClear={() => updateQuery("")}
        onTasteFilterPress={() => navigation.navigate("TasteFilter")}
        results={results}
        onResultPress={(dish) => {
          rememberSearch(filters.query);
          navigation.navigate("DishDetail", { dishId: dish.id });
        }}
      />
    </Screen>
  );
}
