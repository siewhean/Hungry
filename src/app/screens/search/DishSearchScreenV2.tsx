import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Search as SearchIcon, X, Star, ChefHat } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Chip, EmptyState, Screen } from "@/components/ui";
import { getDiscoverStallCollections, useSearchData } from "@/features/search/search";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

const SEARCH_TABS = ["All", "Dishes", "Stalls", "Reads"] as const;
const TASTE_CHIPS = [
  { id: "spicy", label: "Spicy", tokens: ["spicy", "mala", "hiam", "heat"] },
  { id: "coconut", label: "Coconut", tokens: ["coconut", "lemak", "laksa"] },
  { id: "seafood", label: "Seafood", tokens: ["seafood", "fish", "prawn", "satay"] },
  { id: "herb", label: "Herb", tokens: ["herb", "aromatic", "ginger", "fresh"] },
] as const;

export function DishSearchScreenV2() {
  const navigation = useNavigation<RootNavigation>();
  const { palette, radii, spacing } = useHungryTheme();
  const { filters } = useSearchData();
  const profile = useProfileStore((state) => state.profile);
  const updateQuery = useSearchStore((state) => state.updateQuery);
  const [activeTab, setActiveTab] = useState<(typeof SEARCH_TABS)[number]>("Dishes");
  const [activeTasteFilters, setActiveTasteFilters] = useState<string[]>([]);
  const baseCollections = useMemo(
    () => getDiscoverStallCollections(profile, filters.query),
    [filters.query, profile],
  );
  const collections = useMemo(() => {
    if (activeTab === "Reads") {
      return [];
    }

    const filteredByTaste = activeTasteFilters.length
      ? baseCollections.filter((item) => {
          const haystack = item.topDishes
            .map(
              (dish) => `${dish.name} ${dish.tasteTags.join(" ")} ${dish.dietaryFlags.join(" ")}`,
            )
            .join(" ")
            .toLowerCase();
          return activeTasteFilters.every((filterId) => {
            const filter = TASTE_CHIPS.find((chip) => chip.id === filterId);
            return filter?.tokens.some((token) => haystack.includes(token)) ?? true;
          });
        })
      : baseCollections;

    return filteredByTaste.slice(0, 5);
  }, [activeTab, activeTasteFilters, baseCollections]);

  const { width: screenWidth } = useWindowDimensions();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<TextInput | null>(null);
  const searchRevealProgress = useRef(new Animated.Value(0)).current;
  const searchBarWidth = Math.max(screenWidth - spacing[4] * 2, 240);
  const searchIconSize = 56;
  const searchEntryAnimWidth = searchRevealProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, searchBarWidth],
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

  const toggleTasteFilter = (filterId: string) => {
    setActiveTasteFilters((current) =>
      current.includes(filterId) ? current.filter((id) => id !== filterId) : [...current, filterId],
    );
  };

  const entryY = useRef(new Animated.Value(-10)).current;
  const entryOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entryY, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(entryOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [entryOpacity, entryY]);

  return (
    <Screen scroll={false}>
      <Animated.View
        style={{
          flex: 1,
          position: "relative",
          opacity: entryOpacity,
          transform: [{ translateY: entryY }],
        }}
      >
        {isSearchExpanded ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss search"
            onPress={hideSearch}
            style={searchStyles.searchDismissOverlay}
          />
        ) : null}

        {/* Header */}
        <View
          style={{
            paddingHorizontal: spacing[4],
            paddingTop: spacing[2],
            paddingBottom: spacing[2],
          }}
        >
          <AppText variant="h1" style={{ fontSize: 20, fontWeight: "900" }}>
            Discover
          </AppText>
        </View>

        {/* Search Bar Active */}
        <View style={{ paddingHorizontal: spacing[4], marginBottom: spacing[2] }}>
          <View
            style={{
              alignItems: "center",
              width: isSearchExpanded ? searchBarWidth : searchIconSize,
              zIndex: 30,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search"
              onPress={isSearchExpanded ? hideSearch : revealSearch}
              style={{
                width: searchIconSize,
                height: 56,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SearchIcon color={palette.orange} size={20} />
            </Pressable>

            <Animated.View
              pointerEvents={isSearchExpanded ? "auto" : "none"}
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
                borderColor: palette.orange,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[2],
                paddingHorizontal: spacing[3],
                opacity: searchInputOpacity,
                transform: [{ scaleX: searchInputScale }],
              }}
            >
              <Animated.View
                style={{
                  flex: 1,
                  opacity: searchInputOpacity,
                }}
              >
                <TextInput
                  ref={searchInputRef}
                  autoCorrect={false}
                  onBlur={hideSearch}
                  placeholder="Search..."
                  onChangeText={updateQuery}
                  placeholderTextColor={palette.textMuted}
                  style={{
                    color: palette.text,
                    fontFamily: "Nunito_400Regular",
                    fontSize: 16,
                    height: 56,
                    padding: 0,
                    textAlignVertical: "center",
                  }}
                  value={filters.query}
                />
              </Animated.View>
              <Animated.View style={{ opacity: searchInputOpacity }}>
                {filters.query.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    onPress={() => updateQuery("")}
                  >
                    <X color={palette.textMuted} size={18} />
                  </Pressable>
                ) : null}
              </Animated.View>
            </Animated.View>
          </View>
        </View>

        {/* Type Tabs */}
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: spacing[4],
            borderBottomWidth: 1,
            borderBottomColor: palette.border,
            gap: spacing[6],
          }}
        >
          {SEARCH_TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <Pressable
                key={tab}
                accessibilityRole="button"
                accessibilityLabel={`Show ${tab.toLowerCase()} search results`}
                accessibilityState={{ selected: isActive }}
                onPress={() => setActiveTab(tab)}
                style={{
                  paddingVertical: spacing[3],
                  borderBottomWidth: 2,
                  borderBottomColor: isActive ? palette.text : "transparent",
                }}
              >
                <AppText
                  style={{
                    fontSize: 14,
                    fontWeight: isActive ? "700" : "600",
                    color: isActive ? palette.text : palette.textMuted,
                  }}
                >
                  {tab}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing[8] }}
        >
          {/* Section Heading */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "baseline",
              paddingHorizontal: spacing[4],
              paddingTop: spacing[4],
              marginBottom: spacing[2],
            }}
          >
            <AppText variant="h2" style={{ fontSize: 16, fontWeight: "800" }}>
              {filters.query ? `Dishes matching "${filters.query}"` : "Trending dishes"}
            </AppText>
            <AppText variant="micro" tone="secondary" style={{ fontWeight: "600" }}>
              {collections.length} results
            </AppText>
          </View>

          {/* Results List */}
          <View style={{ paddingHorizontal: spacing[4] }}>
            {collections.length === 0 ? (
              <EmptyState
                icon={<ChefHat size={34} color={palette.orange} style={{ opacity: 0.9 }} />}
                title="No food available right now"
                body="There are no dishes in the database at the moment. Try again later or adjust your search."
              />
            ) : null}
            {collections.map((item) => {
              const dish = item.topDishes[0];
              if (!dish) return null;
              return (
                <Pressable
                  key={dish.id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    activeTab === "Stalls" ? `Open ${item.venue.name}` : `Open ${dish.name}`
                  }
                  onPress={() =>
                    activeTab === "Stalls"
                      ? navigation.navigate("StallDetailV2", { venueId: item.venue.id })
                      : navigation.navigate("DishDetail", { dishId: dish.id })
                  }
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
                      width: 52,
                      height: 52,
                      borderRadius: radii.md,
                      backgroundColor: palette.bgSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <AppText style={{ fontSize: 24 }}>🍜</AppText>
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing[3] }}>
                    <AppText variant="bodyBold">{dish.name}</AppText>
                    <View style={{ gap: 2, marginTop: 2 }}>
                      <AppText variant="micro" tone="secondary">
                        {item.venue.name} · 80m
                      </AppText>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                          <Star size={10} color={palette.amber} fill={palette.amber} />
                          <AppText variant="micro" style={{ fontWeight: "700" }}>
                            {dish.rating.toFixed(1)}
                          </AppText>
                        </View>
                        <AppText variant="micro" tone="secondary">
                          · 312 reviews
                        </AppText>
                        <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                          S${dish.price.toFixed(2)}
                        </AppText>
                      </View>
                    </View>
                  </View>
                  <View
                    style={{
                      backgroundColor: palette.successSoft,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 4,
                    }}
                  >
                    <AppText
                      variant="micro"
                      style={{ color: palette.success, fontWeight: "800", fontSize: 10 }}
                    >
                      A
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Taste Filter Quick Access */}
          <View
            style={{
              margin: spacing[4],
              padding: spacing[4],
              backgroundColor: palette.bgSoft,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: palette.border,
            }}
          >
            <AppText variant="bodySmallBold" style={{ marginBottom: spacing[2] }}>
              Filter by taste
            </AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              {TASTE_CHIPS.map((chip) => (
                <Chip
                  key={chip.id}
                  label={chip.label}
                  selected={activeTasteFilters.includes(chip.id)}
                  onPress={() => toggleTasteFilter(chip.id)}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </Screen>
  );
}

const searchStyles = StyleSheet.create({
  searchDismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    zIndex: 20,
  },
});
