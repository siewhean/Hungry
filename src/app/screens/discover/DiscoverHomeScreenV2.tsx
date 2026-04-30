import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import {
  ChevronRight,
  Map,
  Mic,
  Search,
  Star,
  Flame,
  Home,
  Compass,
  Utensils,
  MapPinned,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Chip, Screen, Card, IconButton, Skeleton } from "@/components/ui";
import { DecideForMeCard } from "@/components/discover/DecideForMeCard";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getNearestBuildings } from "@/lib/geo/singaporeBuildings";
import { toRecommendationGeoCell } from "@/lib/geo/recommendationGeoCell";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail, SearchCategory, VenueSummary } from "@/types/domain";

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

const INTENT_CHIPS = [
  { id: "near_me", label: "Near me", category: "all", icon: "MapPinned" },
  { id: "spicy", label: "Spicy", category: "local favourites", icon: "Flame" },
  { id: "rated", label: "Best rated", category: "local favourites", icon: "Star" },
  { id: "hawker", label: "Hawker", category: "rice", icon: "Home" },
  { id: "decide", label: "Decide for me", category: "all", icon: "Shuffle" },
] as const;

export function DiscoverHomeScreenV2() {
  const navigation = useNavigation<RootNavigation>();
  const repository = getDataRepository();
  const { width: screenWidth } = useWindowDimensions();
  const { palette, radii, spacing, shadows, motion, colorScheme } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const locationPermission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualLocation = useLocationStore((state) => state.manualLocation);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const popularNearby = useDiscoveryStore((state) => state.popularNearby ?? []);
  const refreshPopularNearby = useDiscoveryStore((state) => state.refreshPopularNearby);

  useEffect(() => {
    void refreshPopularNearby();
  }, [refreshPopularNearby]);

  const selectedCategories = useSearchStore((state) => state.filters.categories);
  const toggleCategory = useSearchStore((state) => state.toggleCategory);

  const nearbyBuildings = useMemo(
    () => getNearestBuildings(currentLocation.latitude, currentLocation.longitude, 3, 14),
    [currentLocation.latitude, currentLocation.longitude],
  );
  const discoverLocationLabel = manualLocation ?? nearbyBuildings[0]?.name ?? "Nearby";
  const discoverNearbyCount = nearbyBuildings.length || repository.listBuildings().length;

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

  const nearbyStalls = repository
    .listBuildings()
    .flatMap((b) => repository.listVenuesByBuilding(b.id))
    .slice(0, 6)
    .map((venue) => {
      const topDish = repository.getDishById(venue.topDishId);
      return { venue, topDish };
    });

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
    <Screen scroll={false} style={{ backgroundColor: themeTints.bg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing[4],
          paddingTop: spacing[3],
          paddingBottom: spacing[2],
        }}
      >
        <View>
          <AppText variant="h1" style={{ fontSize: 22, fontWeight: "900" }}>
            Discover
          </AppText>
          <AppText variant="micro" tone="secondary">
            {discoverLocationLabel} · {discoverNearbyCount} stalls nearby
          </AppText>
        </View>
        <IconButton
          variant="surface"
          accessibilityLabel="Open map"
          onPress={() => navigation.navigate("DiscoverMap")}
          icon={<Map color={palette.orange} size={20} />}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
      >
        {/* Search Bar */}
        <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[2] }}>
          <Pressable
            onPress={() => navigation.navigate("SearchHomeV2")}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: pressed ? palette.surfaceRaised : palette.bgSoft,
              borderWidth: 1,
              borderColor: palette.border,
              borderRadius: radii.pill,
              height: 52,
              paddingHorizontal: spacing[4],
              gap: spacing[3],
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}
          >
            <Search color={palette.textMuted} size={18} />
            <AppText style={{ flex: 1, color: palette.textMuted }}>
              Dishes, stalls, or hawker centres…
            </AppText>
            <Mic color={palette.textMuted} size={18} />
          </Pressable>
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
                onPress={() => {}}
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
              borderRadius: radii.lg,
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
              <AppText style={{ fontSize: 18 }}>🏪</AppText>
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
              borderRadius: radii.lg,
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
              <AppText style={{ fontSize: 18 }}>🍜</AppText>
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
        <View style={{ marginTop: spacing[6] }}>
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
        <View style={{ marginTop: spacing[6] }}>
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
          </View>

          <View style={{ paddingHorizontal: spacing[4] }}>
            {nearbyStalls.map(({ venue, topDish }, index) => {
              const isStallAccount = index % 2 === 0; // Simulate stall account for visual variety
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
                      borderWidth: isStallAccount ? 2.5 : 1,
                      borderColor: isStallAccount ? palette.orange : palette.border,
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
                      {isStallAccount && (
                        <AppText style={{ color: palette.orange, fontSize: 10, marginLeft: 4 }}>
                          ✦
                        </AppText>
                      )}
                    </View>
                    <View
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: palette.success,
                        }}
                      />
                      <AppText variant="micro" tone="secondary">
                        Open · {venue.buildingId.replace("hc-", "").replace("-", " ")} ·{" "}
                        {venue.unitNumber}
                      </AppText>
                    </View>
                  </View>
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
                      A
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
