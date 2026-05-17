import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Map, Mic, Search, X, Flame, Utensils, MapPinned } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppHeader, AppText, Chip, Screen, IconButton, Skeleton } from "@/components/ui";
import { DecideForMeCard } from "@/components/discover/DecideForMeCard";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getNearestSingaporeArea } from "@/lib/geo/singaporeBuildings";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";
import { NEUTRAL_TASTE_VECTOR, TASTE_LABELS } from "@/constants/taste";
import { useProfileStore } from "@/store/useProfileStore";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useMerchantStore } from "@/store/useMerchantStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useCollectionStore } from "@/store/useCollectionStore";
import { useHungryTheme } from "@/theme";
import { CollectionCard } from "@/components/collections/CollectionCard";
import { useMovingSearchPlaceholder } from "@/features/search/useMovingSearchPlaceholder";
import { FEATURE_FLAGS } from "@/constants/featureFlags";

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

const INTENT_CHIPS = [
  { id: "near_me", label: "Near me", category: "all", icon: "MapPinned" },
  { id: "spicy", label: "Spicy", category: "local favourites", icon: "Flame" },
  { id: "rated", label: "Best rated", category: "local favourites", icon: "Star" },
  { id: "hawker", label: "Hawker", category: "rice", icon: "Home" },
  { id: "decide", label: "Decide for me", category: "all", icon: "Shuffle" },
] as const;
const SEARCH_PLACEHOLDER_DEFAULT = "Dishes, stalls, or hawker centres…";
const TASTE_DIMENSIONS = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"] as const;
const TASTE_INTEREST_THRESHOLD = 6.8;

export function DiscoverHomeScreenV2() {
  const navigation = useNavigation<RootNavigation>();
  const repository = getDataRepository();
  const { width: screenWidth } = useWindowDimensions();
  const { componentRadii, palette, radii, spacing, semanticSpacing, shadows, motion, colorScheme } =
    useHungryTheme();
  const locationPermission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualLocation = useLocationStore((state) => state.manualLocation);
  const grantLocation = useLocationStore((state) => state.grantLocation);
  const isDeveloperMode = useMerchantStore((state) => state.developerMerchantMode);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (locationPermission !== "granted" && !manualLocation) {
      void grantLocation();
    }
  }, [locationPermission, manualLocation, grantLocation]);

  const popularNearby = useDiscoveryStore((state) => state.popularNearby);
  const refreshPopularNearby = useDiscoveryStore((state) => state.refreshPopularNearby);

  useEffect(() => {
    void refreshPopularNearby();
  }, [refreshPopularNearby]);

  const searchQuery = useSearchStore((state) => state.filters.query);
  const updateSearchQuery = useSearchStore((state) => state.updateQuery);
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const recentSearches = useSearchStore((state) => state.recentSearches);
  const safeRecentSearches = useMemo(
    () =>
      Array.isArray(recentSearches)
        ? recentSearches
            .map((search) =>
              typeof search === "string" ? search.trim() : String(search ?? "").trim(),
            )
            .filter(Boolean)
        : [],
    [recentSearches],
  );
  const profile = useProfileStore((state) => state.profile);
  const tasteVector = profile?.tasteVector ?? NEUTRAL_TASTE_VECTOR;

  const allCollections = useCollectionStore((s) => s.collections);
  const collections = useMemo(
    () => (FEATURE_FLAGS.collectionsEnabled ? allCollections.slice(0, 6) : []),
    [allCollections],
  );
  const loadCollections = useCollectionStore((s) => s.loadCollections);
  useEffect(() => {
    void loadCollections();
  }, [loadCollections]);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<TextInput | null>(null);
  const searchRevealProgress = useRef(new Animated.Value(0)).current;
  const searchBarWidth = useMemo(
    () => Math.max(screenWidth - spacing[4] * 2, 240),
    [screenWidth, spacing],
  );
  const searchIconSize = 52;

  const revealSearch = useCallback(() => {
    if (isSearchExpanded) return;
    setIsSearchExpanded(true);
    const revealDuration = Math.max(motion.screenTransition, 340);
    searchRevealProgress.stopAnimation();
    searchRevealProgress.setValue(0);
    Animated.timing(searchRevealProgress, {
      toValue: 1,
      duration: revealDuration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      searchInputRef.current?.focus();
    });
  }, [isSearchExpanded, motion.screenTransition, searchRevealProgress]);

  const hideSearch = useCallback(() => {
    const hideDuration = Math.max(motion.microInteraction, 260);
    if (!isSearchExpanded) return;
    searchRevealProgress.stopAnimation(() =>
      Animated.timing(searchRevealProgress, {
        toValue: 0,
        duration: hideDuration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        setIsSearchExpanded(false);
        searchInputRef.current?.blur();
      }),
    );
  }, [isSearchExpanded, motion.microInteraction, searchRevealProgress]);

  useEffect(() => {
    return () => {
      searchRevealProgress.stopAnimation();
      searchRevealProgress.setValue(0);
    };
  }, [searchRevealProgress]);

  const submitSearch = useCallback(() => {
    const trimmedQuery = searchQuery.trim();
    navigation.navigate("SearchHomeV2");
    hideSearch();
    if (trimmedQuery) {
      scheduleIdleWork(
        () => {
          rememberSearch(trimmedQuery);
        },
        { timeout: 500, fallbackDelayMs: 80 },
      );
    }
  }, [hideSearch, navigation, rememberSearch, searchQuery]);

  const cancelSearch = useCallback(() => {
    updateSearchQuery("");
    hideSearch();
  }, [hideSearch, updateSearchQuery]);

  const searchPanelWidth = useMemo(() => Math.max(searchBarWidth, 240), [searchBarWidth]);
  const searchEntryWidth = searchRevealProgress.interpolate({
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
  const discoverSearchPhrases = useMemo(() => {
    const placeholders = [SEARCH_PLACEHOLDER_DEFAULT];
    const seen = new Set([SEARCH_PLACEHOLDER_DEFAULT.toLowerCase()]);
    const addUniquePhrase = (value: string) => {
      const phrase = value.trim();
      if (!phrase) {
        return;
      }
      const key = phrase.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        placeholders.push(phrase);
      }
    };

    safeRecentSearches.slice(0, 3).forEach((search) => {
      addUniquePhrase(`Try ${search.trim()} near you`);
    });

    const interestPhrases = TASTE_DIMENSIONS.map((dimension) => ({
      dimension,
      score: tasteVector[dimension],
      label: TASTE_LABELS[dimension],
    }))
      .filter((entry) => entry.score >= TASTE_INTEREST_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => `${entry.label} bites nearby`);

    interestPhrases.forEach(addUniquePhrase);

    if (placeholders.length < 2) {
      ["Try laksa", "Nasi lemak near you", "Search by stall"].forEach((fallback) =>
        addUniquePhrase(fallback),
      );
    }

    return placeholders;
  }, [safeRecentSearches, tasteVector]);
  const movingSearchPlaceholder = useMovingSearchPlaceholder({
    phrases: discoverSearchPhrases,
    totalCycleMs: 2400,
    tickMs: 2,
    revealStepMs: 2,
    deleteStepMs: 2,
    pauseMs: 300,
  });

  const discoverLocationLabel =
    manualLocation ?? getNearestSingaporeArea(currentLocation.latitude, currentLocation.longitude);

  const themeTints = useMemo(() => {
    const isDark = colorScheme === "dark";
    return {
      bg: palette.bg,
      text: palette.text,
      cardBg: palette.surface,
      secondaryText: palette.textSecondary,
      isDark,
    };
  }, [palette, colorScheme]);

  const recommendedDishes = popularNearby.slice(0, 5);

  const handleIntentChipPress = (chip: (typeof INTENT_CHIPS)[number]) => {
    const trackIntentTap = () => {
      scheduleIdleWork(
        () => {
          trackAnalyticsEvent("discover_intent_chip_tapped", {
            chip_id: chip.id,
            category: chip.category,
          });
        },
        { timeout: 500, fallbackDelayMs: 80 },
      );
    };

    if (chip.id === "near_me") {
      navigation.navigate("DiscoverMap");
      trackIntentTap();
      return;
    }

    if (chip.id === "spicy") {
      navigation.navigate("SearchResults", {
        browseMode: "dishes",
        initialQuery: "spicy",
        initialFilter: "Spicy",
      });
      scheduleIdleWork(
        () => {
          updateSearchQuery("spicy");
          rememberSearch("spicy");
          trackAnalyticsEvent("discover_intent_chip_tapped", {
            chip_id: chip.id,
            category: chip.category,
          });
        },
        { timeout: 500, fallbackDelayMs: 80 },
      );
      return;
    }

    if (chip.id === "rated") {
      navigation.navigate("SearchResults", { browseMode: "dishes" });
      trackIntentTap();
      return;
    }

    if (chip.id === "hawker") {
      navigation.navigate("SearchResults", { browseMode: "stalls" });
      trackIntentTap();
      return;
    }

    navigation.navigate("DecideForMeResult");
    trackIntentTap();
  };

  const nearbyStalls = repository
    .listBuildings()
    .flatMap((b) => repository.listVenuesByBuilding(b.id))
    .slice(0, 6)
    .map((venue) => {
      const topDish = repository.getDishById(venue.topDishId);
      return { venue, topDish };
    });
  const discoverNearbyCount = nearbyStalls.length;

  if (isLoading) {
    return (
      <Screen style={{ backgroundColor: themeTints.bg }}>
        <View style={{ padding: spacing[4], gap: spacing[6] }}>
          <Skeleton width="50%" height={32} />
          <Skeleton width="100%" height={52} borderRadius={radii.pill} />
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <Skeleton width={100} height={40} borderRadius={radii.pill} />
            <Skeleton width={100} height={40} borderRadius={radii.pill} />
            <Skeleton width={100} height={40} borderRadius={radii.pill} />
          </View>
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <Skeleton
              width={(screenWidth - spacing[12]) / 2}
              height={120}
              borderRadius={radii.lg}
            />
            <Skeleton
              width={(screenWidth - spacing[12]) / 2}
              height={120}
              borderRadius={radii.lg}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} fullWidth style={{ backgroundColor: themeTints.bg }}>
      {/* Header */}
      <AppHeader
        title="Discover"
        subtitle={`${discoverLocationLabel} · ${discoverNearbyCount} stalls nearby`}
        horizontalPadding={semanticSpacing.screenEdge}
        right={
          <IconButton
            variant="surface"
            accessibilityLabel="Open map"
            onPress={() => navigation.navigate("DiscoverMap")}
            icon={<Map color={palette.orange} size={20} />}
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
      >
        {/* Search Bar */}
        <View
          style={{ alignItems: "flex-end", paddingHorizontal: spacing[4], marginTop: spacing[2] }}
        >
          <View
            style={{
              width: isSearchExpanded ? searchPanelWidth : searchIconSize,
              position: "relative",
              alignItems: "flex-end",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search dishes, stalls, or hawker centres"
              onPress={isSearchExpanded ? hideSearch : revealSearch}
              style={{
                width: searchIconSize,
                height: 52,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: componentRadii.iconButton,
              }}
            >
              <Search color={palette.textMuted} size={18} />
            </Pressable>
          </View>

          <Animated.View
            pointerEvents={isSearchExpanded ? "auto" : "none"}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              height: 52,
              borderRadius: componentRadii.search,
              overflow: "hidden",
              backgroundColor: palette.bgSoft,
              width: searchEntryWidth,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing[3],
              borderWidth: 1,
              borderColor: palette.border,
              paddingRight: spacing[3],
              opacity: searchInputOpacity,
              transform: [{ scaleX: searchInputScale }],
            }}
          >
            <Animated.View
              style={{
                flex: 1,
                opacity: searchInputOpacity,
                overflow: "hidden",
              }}
            >
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={updateSearchQuery}
                placeholder={movingSearchPlaceholder}
                placeholderTextColor={palette.textMuted}
                returnKeyType="search"
                clearButtonMode="while-editing"
                style={{
                  color: palette.text,
                  fontSize: 15,
                  fontFamily: "Nunito_400Regular",
                  height: 52,
                  width: "100%",
                }}
                onSubmitEditing={submitSearch}
              />
            </Animated.View>
            <Animated.View style={{ opacity: searchInputOpacity }}>
              {searchQuery.length > 0 ? (
                <Pressable accessibilityRole="button" onPress={cancelSearch}>
                  <X size={17} color={palette.textMuted} />
                </Pressable>
              ) : (
                <Mic color={palette.textMuted} size={18} />
              )}
            </Animated.View>
          </Animated.View>
        </View>

        {/* Intent Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
            gap: spacing[2],
          }}
        >
          {INTENT_CHIPS.map((chip) => {
            const isActive = chip.id === "near_me";
            return (
              <Chip
                key={chip.id}
                label={chip.label}
                selected={isActive}
                onPress={() => handleIntentChipPress(chip)}
                leftIcon={
                  chip.id === "spicy" ? (
                    <Flame size={14} color={isActive ? palette.orange : palette.textSecondary} />
                  ) : chip.id === "near_me" ? (
                    <MapPinned
                      size={14}
                      color={isActive ? palette.orange : palette.textSecondary}
                    />
                  ) : null
                }
              />
            );
          })}
        </ScrollView>

        {/* Large Tap Targets */}
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: spacing[4],
            gap: spacing[3],
            marginTop: spacing[1],
          }}
        >
          <Pressable
            onPress={() => navigation.navigate("SearchResults")}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: pressed ? palette.surfaceRaised : palette.bgSoft,
              borderRadius: componentRadii.card,
              padding: spacing[4],
              gap: spacing[2],
              borderWidth: 1,
              borderColor: palette.border,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}
          >
            <View
              style={{
                width: 36,
                height: 36,
                backgroundColor: palette.orangeLight,
                borderRadius: radii.md,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MapPinned color={palette.orange} size={18} />
            </View>
            <View>
              <AppText variant="bodyBold">Stalls & Restaurants</AppText>
              <AppText variant="micro" tone="secondary">
                Browse by venue near you
              </AppText>
            </View>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("SearchHomeV2")}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: pressed ? palette.surfaceRaised : palette.bgSoft,
              borderRadius: componentRadii.card,
              padding: spacing[4],
              gap: spacing[2],
              borderWidth: 1,
              borderColor: palette.border,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}
          >
            <View
              style={{
                width: 36,
                height: 36,
                backgroundColor: palette.orangeLight,
                borderRadius: radii.md,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Utensils color={palette.orange} size={18} />
            </View>
            <View>
              <AppText variant="bodyBold">Dishes</AppText>
              <AppText variant="micro" tone="secondary">
                Find your craving first
              </AppText>
            </View>
          </Pressable>
        </View>

        {/* Decide for Me */}
        <View style={{ marginTop: spacing[4] }}>
          <DecideForMeCard />
        </View>

        {/* Trending Near You */}
        <View style={{ marginTop: spacing[4] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "baseline",
              paddingHorizontal: spacing[4],
              marginBottom: spacing[2],
            }}
          >
            <AppText variant="h2" style={{ fontWeight: "800" }}>
              Trending near you
            </AppText>
            <Pressable onPress={() => navigation.navigate("SearchResults")}>
              <AppText variant="bodySmallBold" tone="accent">
                See all
              </AppText>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing[4], gap: spacing[3] }}
          >
            {recommendedDishes.map((dish) => (
              <Pressable
                key={dish.id}
                onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                style={{
                  width: 140,
                  backgroundColor: palette.surface,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: palette.border,
                  overflow: "hidden",
                  ...shadows.card,
                }}
              >
                <Image
                  source={{ uri: dish.imageUrl }}
                  style={{ width: "100%", height: 100, backgroundColor: palette.bgSoft }}
                  contentFit="cover"
                />
                <View style={{ padding: spacing[2] }}>
                  <AppText variant="bodySmallBold" numberOfLines={1}>
                    {dish.name}
                  </AppText>
                  <AppText variant="micro" tone="secondary" numberOfLines={1}>
                    {dish.venueName}
                  </AppText>
                  <AppText variant="bodySmallBold" tone="accent" style={{ marginTop: 2 }}>
                    S${dish.price.toFixed(2)}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Stalls Near You */}
        <View style={{ marginTop: spacing[4] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "baseline",
              paddingHorizontal: spacing[4],
              marginBottom: spacing[2],
            }}
          >
            <AppText variant="h2" style={{ fontWeight: "800" }}>
              Stalls near you
            </AppText>
            <Pressable onPress={() => navigation.navigate("DiscoverMap")}>
              <AppText variant="bodySmallBold" tone="accent">
                Map view
              </AppText>
            </Pressable>
            {isDeveloperMode ? null : (
              <Pressable
                onPress={() => navigation.navigate("SearchResults", { browseMode: "stalls" })}
              >
                <AppText variant="bodySmallBold" tone="accent">
                  View all
                </AppText>
              </Pressable>
            )}
          </View>

          <View style={{ paddingHorizontal: spacing[4] }}>
            {nearbyStalls.map(({ venue, topDish }) => {
              const isVerified = venue.verificationStatus === "verified";
              const statusLabel = venue.isOpen ? "Open" : (venue.closureNotice ?? "Closed");
              return (
                <Pressable
                  key={venue.id}
                  onPress={() => navigation.navigate("StallDetailV2", { venueId: venue.id })}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: spacing[3],
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: radii.md,
                      borderWidth: isVerified ? 2.5 : 1,
                      borderColor: isVerified ? palette.orange : palette.border,
                      padding: 2,
                      backgroundColor: palette.bgSoft,
                    }}
                  >
                    <Image
                      source={{ uri: topDish?.imageUrl }}
                      style={{ width: "100%", height: "100%", borderRadius: radii.sm }}
                      contentFit="cover"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing[3] }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <AppText variant="bodyBold">{venue.name}</AppText>
                      {isVerified ? (
                        <AppText style={{ color: palette.orange, fontSize: 10, marginLeft: 4 }}>
                          Verified
                        </AppText>
                      ) : null}
                    </View>
                    <View
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: venue.isOpen ? palette.success : palette.textMuted,
                        }}
                      />
                      <AppText variant="micro" tone="secondary">
                        {statusLabel} · {venue.buildingId.replace("hc-", "").replace("-", " ")} ·{" "}
                        {venue.unitNumber}
                      </AppText>
                    </View>
                  </View>
                  {isVerified ? (
                    <View
                      style={{
                        backgroundColor: palette.successSoft,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 4,
                        borderWidth: 1,
                        borderColor: palette.success,
                      }}
                    >
                      <AppText
                        variant="micro"
                        style={{ color: palette.success, fontWeight: "900", fontSize: 10 }}
                      >
                        Verified
                      </AppText>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Collections */}
        {collections.length > 0 && (
          <View style={{ marginTop: spacing[4] }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "baseline",
                paddingHorizontal: spacing[4],
                marginBottom: spacing[2],
              }}
            >
              <AppText variant="h2" style={{ fontWeight: "800" }}>
                Collections
              </AppText>
              <Pressable onPress={() => navigation.navigate("CollectionList")}>
                <AppText variant="bodySmallBold" tone="accent">
                  See all
                </AppText>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing[4], gap: spacing[3] }}
            >
              {collections.map((collection) => (
                <Pressable
                  key={collection.id}
                  onPress={() =>
                    navigation.navigate("CollectionDetail", { collectionId: collection.id })
                  }
                  style={{
                    width: 220,
                    backgroundColor: palette.surface,
                    borderRadius: componentRadii.card,
                    borderWidth: 1,
                    borderColor: palette.border,
                    overflow: "hidden",
                    ...shadows.card,
                  }}
                >
                  <CollectionCard
                    collection={collection}
                    onPress={() =>
                      navigation.navigate("CollectionDetail", { collectionId: collection.id })
                    }
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
