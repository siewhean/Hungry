import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { ChevronRight, Compass, MapPinned, Search, Shuffle, Star, Flame, Home, Compass as CompassIcon, Utensils } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

import { AppText, Chip, Input, Screen } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { SearchCategory } from "@/types/domain";

const INTENT_CHIPS = [
  { id: "spicy", label: "Spicy", category: "local favourites" },
  { id: "halal", label: "Halal", category: "rice" },
  { id: "late", label: "Late night", category: "late night" },
  { id: "cheap", label: "Value", category: "noodles" },
] as const;

export function DiscoverHomeScreen() {
  const navigation = useNavigation<any>();
  const { width: screenWidth } = useWindowDimensions();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const { popularNearby, setDecideForMe } = useDiscoveryStore();
  const selectedCategories = useSearchStore((state) => state.filters.categories);
  const toggleCategory = useSearchStore((state) => state.toggleCategory);

  const recommendedDishes = popularNearby.slice(0, 4);
  const nearbyVenues = mockRepository.listBuildings()
    .slice(0, 4)
    .map((building) => {
      const venues = mockRepository.listVenuesByBuilding(building.id);
      const venue = venues[0];
      const topDish = venue ? mockRepository.getDishById(venue.topDishId) : undefined;
      return venue ? { building, venue, topDish } : null;
    })
    .filter(Boolean) as Array<{
    building: any;
    venue: NonNullable<ReturnType<typeof mockRepository.getVenueById>>;
    topDish: ReturnType<typeof mockRepository.getDishById>;
  }>;

  const handleDecideForMe = () => {
    const picked = mockRepository.getDecideForMe(profile.tasteVector);
    if (picked) {
      setDecideForMe(picked);
    }
    navigation.navigate("DecideForMeResult");
  };

  return (
    <Screen scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[6], paddingBottom: spacing[24] }}
      >
        {/* Dynamic Location Header */}
        <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[2] }}>
          <AppText variant="micro" tone="accent" style={{ letterSpacing: 1, marginBottom: 2 }}>
            YOU ARE AT
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText variant="h1" style={{ fontSize: 28 }}>Tanjong Pagar</AppText>
            <Pressable 
              onPress={() => navigation.navigate("Maps")}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: palette.orangeLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill }}
            >
              <MapPinned color={palette.orange} size={14} />
              <AppText variant="micro" style={{ color: palette.orange, fontWeight: "700" }}>MAP</AppText>
            </Pressable>
          </View>
        </View>

        {/* Search Bar Entry */}
        <View style={{ paddingHorizontal: spacing[4] }}>
          <Pressable 
            onPress={() => navigation.navigate("SearchHome")}
            style={[
              shadows.card,
              {
                backgroundColor: palette.surface,
                borderRadius: radii.md,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: spacing[4],
                height: 52,
                gap: spacing[3],
                borderWidth: 1,
                borderColor: palette.border,
              }
            ]}
          >
            <Search color={palette.textMuted} size={20} />
            <AppText tone="secondary" style={{ flex: 1 }}>Search dishes, stalls or vibes...</AppText>
          </Pressable>
        </View>

        {/* Intent Chips with Icons */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[2], paddingHorizontal: spacing[4] }}
        >
          {INTENT_CHIPS.map((chip) => {
            const isActive = selectedCategories.includes(chip.category as SearchCategory);
            return (
              <Chip
                key={chip.id}
                label={chip.label}
                selected={isActive}
                onPress={() => toggleCategory(chip.category as SearchCategory)}
                leftIcon={chip.id === "spicy" ? <Flame size={14} color={isActive ? palette.orange : palette.textSecondary} /> : 
                          chip.id === "halal" ? <Home size={14} color={isActive ? palette.orange : palette.textSecondary} /> :
                          chip.id === "late" ? <Compass size={14} color={isActive ? palette.orange : palette.textSecondary} /> :
                          <Utensils size={14} color={isActive ? palette.orange : palette.textSecondary} />}
              />
            );
          })}
        </ScrollView>

        {/* Proactive Selection Grid */}
        <View style={{ flexDirection: "row", gap: spacing[3], paddingHorizontal: spacing[4] }}>
          <Pressable
            onPress={handleDecideForMe}
            style={[
              shadows.card,
              {
                backgroundColor: palette.orange,
                borderRadius: radii.lg,
                flex: 1,
                padding: spacing[4],
                minHeight: 120,
                justifyContent: "space-between",
              },
            ]}
          >
            <Shuffle color="#FFFFFF" size={24} />
            <View>
              <AppText variant="h3" tone="inverse">Decide For Me</AppText>
              <AppText variant="micro" tone="inverse" style={{ opacity: 0.8 }}>Single-player pick</AppText>
            </View>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("WheelStack", { screen: "WheelHome" })}
            style={[
              shadows.card,
              {
                backgroundColor: palette.navy,
                borderRadius: radii.lg,
                flex: 1,
                padding: spacing[4],
                minHeight: 120,
                justifyContent: "space-between",
              },
            ]}
          >
            <Compass color="#FFFFFF" size={24} />
            <View>
              <AppText variant="h3" tone="inverse">Hungry Wheel</AppText>
              <AppText variant="micro" tone="inverse" style={{ opacity: 0.8 }}>Party mode</AppText>
            </View>
          </Pressable>
        </View>

        {/* Recommended Dishes (Carousel) */}
        <View style={{ gap: spacing[3] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing[4] }}>
            <AppText variant="h2">Trending Nearby</AppText>
            <Pressable onPress={() => navigation.navigate("SearchResults")}>
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>SEE ALL</AppText>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[4], paddingHorizontal: spacing[4] }}
          >
            {recommendedDishes.map((dish) => (
              <Pressable
                key={dish.id}
                onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                style={[
                  shadows.card,
                  {
                    backgroundColor: palette.surface,
                    borderRadius: radii.lg,
                    overflow: "hidden",
                    width: screenWidth * 0.65,
                  },
                ]}
              >
                <Image source={{ uri: dish.imageUrl }} style={{ height: 160, width: "100%" }} contentFit="cover" />
                <View style={{ padding: spacing[3], gap: 2 }}>
                  <AppText variant="h3" numberOfLines={1}>{dish.name}</AppText>
                  <AppText variant="micro" tone="secondary">{dish.venueName}</AppText>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                    <AppText variant="price" style={{ color: palette.orange }}>S${dish.price.toFixed(2)}</AppText>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                      <Star color={palette.amber} size={12} fill={palette.amber} />
                      <AppText variant="micro" style={{ fontWeight: "700" }}>{dish.rating.toFixed(1)}</AppText>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Stalls Near You (Horizontal Selection) */}
        <View style={{ gap: spacing[3] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing[4] }}>
            <AppText variant="h2">Stalls Near You</AppText>
            <Pressable onPress={() => navigation.navigate("Maps")}>
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>VIEW MAP</AppText>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[3], paddingHorizontal: spacing[4] }}
          >
            {nearbyVenues.map(({ venue, topDish }) => (
              <Pressable
                key={venue.id}
                onPress={() => navigation.navigate("MapZoomedIn", { buildingId: venue.buildingId })}
                style={[
                  shadows.card,
                  {
                    backgroundColor: palette.surface,
                    borderRadius: radii.lg,
                    width: 160,
                    padding: spacing[3],
                    gap: spacing[2],
                  },
                ]}
              >
                <Image
                  source={{ uri: topDish?.imageUrl }}
                  style={{ borderRadius: radii.md, height: 100, width: "100%" }}
                  contentFit="cover"
                />
                <View style={{ gap: 2 }}>
                  <AppText variant="bodySmall" style={{ fontWeight: "700" }} numberOfLines={1}>{venue.name}</AppText>
                  <AppText variant="micro" tone="secondary" numberOfLines={1}>{venue.unitNumber} · {venue.operatingHours.split("–")[0]}</AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </Screen>
  );
}
