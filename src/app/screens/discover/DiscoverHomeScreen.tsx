import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useMemo } from "react";
import { ChevronRight, Compass, MapPinned, Search, Shuffle } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

import { AppText, Chip, Input, Screen } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { SearchCategory } from "@/types/domain";

const FILTER_CHIPS = ["Spicy", "Halal", "Late night", "Cheap"] as const;
const CHIP_TO_CATEGORY: Record<(typeof FILTER_CHIPS)[number], SearchCategory> = {
  Spicy: "local favourites",
  Halal: "rice",
  "Late night": "late night",
  Cheap: "noodles",
};

export function DiscoverHomeScreen() {
  const navigation = useNavigation<any>();
  const { width: screenWidth } = useWindowDimensions();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const { popularNearby, setDecideForMe } = useDiscoveryStore();
  const selectedCategories = useSearchStore((state) => state.filters.categories);
  const toggleCategory = useSearchStore((state) => state.toggleCategory);

  const buildings = mockRepository.listBuildings();
  const recommendedDishes = popularNearby.slice(0, 4);
  const nearestBuilding = useMemo(() => buildings[0], [buildings]);
  const nearbyVenues = buildings
    .slice(0, 4)
    .map((building) => {
      const venue = mockRepository.listVenuesByBuilding(building.id)[0];
      const topDish = venue ? mockRepository.getDishById(venue.topDishId) : undefined;
      return venue ? { building, venue, topDish } : null;
    })
      .filter(Boolean) as Array<{
    building: (typeof buildings)[number];
    venue: NonNullable<ReturnType<typeof mockRepository.getVenueById>>;
    topDish: ReturnType<typeof mockRepository.getDishById>;
  }>;
  const recommendedCardWidth = Math.max(212, Math.min(244, screenWidth * 0.62));

  const toggleChip = (label: (typeof FILTER_CHIPS)[number]) => {
    const category = CHIP_TO_CATEGORY[label];
    toggleCategory(category);
  };

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
        contentContainerStyle={{ gap: spacing[5], paddingBottom: spacing[12] }}
      >
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1, gap: spacing[1] }}>
            <AppText variant="bodySmall" tone="muted">
              Tanjong Pagar · 14 stalls nearby
            </AppText>
            <AppText variant="h1">Discover</AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Hungry Wheel"
            onPress={() => navigation.navigate("WheelStack", { screen: "WheelHome" })}
            style={{
              alignItems: "center",
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: radii.md,
              borderWidth: 1,
              height: 40,
              justifyContent: "center",
              width: 40,
            }}
          >
            <Shuffle color={palette.navy} size={18} />
          </Pressable>
        </View>

        <Pressable onPress={() => navigation.navigate("SearchHome")}>
          <View pointerEvents="none">
            <Input
              leftIcon={<Search color={palette.textMuted} size={18} />}
              placeholder="laksa, briyani, late supper..."
              editable={false}
            />
          </View>
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[2] }}
        >
          {FILTER_CHIPS.map((label) => (
            <Chip
              key={label}
              label={label}
              selected={selectedCategories.includes(CHIP_TO_CATEGORY[label])}
              onPress={() => toggleChip(label)}
            />
          ))}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <QuickLinkCard
            label="Stalls"
            subtitle="Browse by centre"
            onPress={() => navigation.navigate("Maps")}
          />
          <QuickLinkCard
            label="Dishes"
            subtitle="Jump to search"
            onPress={() => navigation.navigate("SearchHome")}
          />
        </View>

        {/* Proactive Nearby Card */}
        <Pressable
          onPress={() => navigation.navigate("BuildingDrillDown", { buildingId: nearestBuilding.id })}
          style={[
            shadows.floating,
            {
              backgroundColor: palette.navy,
              borderRadius: radii.lg,
              padding: spacing[4],
              flexDirection: "row",
              alignItems: "center",
              gap: spacing[4],
            },
          ]}
        >
          <View style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: radii.lg, padding: spacing[3] }}>
            <MapPinned color="#FFFFFF" size={24} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="micro" style={{ color: "rgba(255,255,255,0.6)", fontWeight: "700", textTransform: "uppercase" }}>
              You are at
            </AppText>
            <AppText variant="h2" tone="inverse">
              {nearestBuilding.name}
            </AppText>
            <AppText variant="bodySmall" style={{ color: "rgba(255,255,255,0.8)" }}>
              Tap to browse {nearestBuilding.venueCount} stalls inside.
            </AppText>
          </View>
          <ChevronRight color="#FFFFFF" size={20} />
        </Pressable>

        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <Pressable
            onPress={handleDecideForMe}
            style={[
              shadows.card,
              {
                backgroundColor: palette.orange,
                borderRadius: radii.lg,
                flex: 1,
                minHeight: 156,
                overflow: "hidden",
                padding: spacing[4],
              },
            ]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[3] }}>
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.16)",
                  borderRadius: radii.md,
                  height: 42,
                  justifyContent: "center",
                  width: 42,
                }}
              >
                <Compass color="#FFFFFF" size={20} />
              </View>
              <ChevronRight color="#FFFFFF" size={18} />
            </View>
            <View style={{ gap: spacing[1], marginTop: spacing[3] }}>
              <AppText variant="h3" tone="inverse">
                Decide For Me
              </AppText>
              <AppText variant="bodySmall" tone="inverse">
                Let Hungry pick based on your profile.
              </AppText>
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
                minHeight: 156,
                overflow: "hidden",
                padding: spacing[4],
              },
            ]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[3] }}>
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.16)",
                  borderRadius: radii.md,
                  height: 42,
                  justifyContent: "center",
                  width: 42,
                }}
              >
                <Shuffle color="#FFFFFF" size={20} />
              </View>
              <ChevronRight color="#FFFFFF" size={18} />
            </View>
            <View style={{ gap: spacing[1], marginTop: spacing[3] }}>
              <AppText variant="h3" tone="inverse">
                Wheel
              </AppText>
              <AppText variant="bodySmall" tone="inverse">
                Spin with friends and let chance decide.
              </AppText>
            </View>
          </Pressable>
        </View>

        <View style={{ gap: spacing[3] }}>
          <SectionHeader
            title="Recommended dishes"
            actionLabel="See all"
            onPress={() => navigation.navigate("SearchResults")}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[3] }}
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
                    width: recommendedCardWidth,
                  },
                ]}
              >
                <Image
                  source={{ uri: dish.imageUrl }}
                  style={{ height: 170, width: "100%" }}
                  contentFit="cover"
                />
                <View style={{ gap: spacing[1], padding: spacing[4] }}>
                  <AppText variant="h3" numberOfLines={1}>
                    {dish.name}
                  </AppText>
                  <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                    {dish.venueName}
                  </AppText>
                  <View
                    style={{
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: spacing[2],
                    }}
                  >
                    <AppText variant="price">S${dish.price.toFixed(2)}</AppText>
                    <AppText variant="bodySmall" tone="secondary">
                      {dish.rating.toFixed(1)} · {dish.distanceMeters}m
                    </AppText>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <Pressable
          onPress={() => navigation.navigate("Maps")}
          style={{
            backgroundColor: palette.bgSoft,
            borderRadius: radii.lg,
            gap: spacing[3],
            overflow: "hidden",
            padding: spacing[4],
          }}
        >
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, gap: spacing[1] }}>
              <AppText variant="h2">Map browse</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Open nearby centres, then zoom into the map for stalls around you.
              </AppText>
            </View>
            <MapPinned color={palette.navy} size={20} />
          </View>
          <View
            style={{
              backgroundColor: palette.bgMuted,
              borderRadius: radii.lg,
              height: 172,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {buildings.slice(0, 3).map((building, index) => (
              <View
                key={building.id}
                style={{
                  backgroundColor:
                    building.type === "hawker_centre"
                      ? palette.orange
                      : building.type === "food_court"
                        ? palette.teal
                        : palette.textMuted,
                  borderRadius: radii.pill,
                  height: 18,
                  left: index === 0 ? "18%" : index === 1 ? "54%" : "72%",
                  position: "absolute",
                  top: index === 0 ? "26%" : index === 1 ? "54%" : "34%",
                  width: 18,
                }}
              />
            ))}
            <View
              style={[
                shadows.card,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  bottom: spacing[3],
                  left: spacing[3],
                  padding: spacing[3],
                  position: "absolute",
                  right: spacing[3],
                },
              ]}
            >
              <AppText variant="body">3 centres nearby</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Maxwell, Lau Pa Sat, and Amoy Street are all within quick walking distance.
              </AppText>
            </View>
          </View>
        </Pressable>

        <View style={{ gap: spacing[3] }}>
          <SectionHeader
            title="Stalls near you"
            actionLabel="View map"
            onPress={() => navigation.navigate("Maps")}
          />
          {nearbyVenues.map(({ building, venue, topDish }) => (
            <Pressable
              key={venue.id}
              onPress={() => navigation.navigate("StallDetail", { venueId: venue.id })}
              style={[
                shadows.card,
                {
                  backgroundColor: palette.surface,
                  borderRadius: radii.lg,
                  overflow: "hidden",
                },
              ]}
            >
              <View style={{ flexDirection: "row", gap: spacing[3], padding: spacing[4] }}>
                <Image
                  source={{ uri: topDish?.imageUrl ?? undefined }}
                  style={{ borderRadius: radii.md, height: 84, width: 84 }}
                  contentFit="cover"
                />
                <View style={{ flex: 1, gap: spacing[1] }}>
                  <AppText variant="h3">{venue.name}</AppText>
                  <AppText variant="bodySmall" tone="secondary">
                    {building.name} · {venue.floor} {venue.unitNumber}
                  </AppText>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                    <View
                      style={{
                        backgroundColor: venue.isOpen ? palette.success : palette.error,
                        borderRadius: radii.pill,
                        height: 8,
                        width: 8,
                      }}
                    />
                    <AppText variant="bodySmall" tone="secondary">
                      {venue.isOpen ? "Open now" : "Closed"} · {venue.operatingHours}
                    </AppText>
                  </View>
                  {topDish ? (
                    <View
                      style={{
                        alignItems: "center",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginTop: spacing[2],
                      }}
                    >
                      <AppText variant="bodySmall">{topDish.name}</AppText>
                      <AppText variant="price">S${topDish.price.toFixed(2)}</AppText>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function QuickLinkCard({
  label,
  subtitle,
  onPress,
}: {
  label: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: palette.bgSoft,
        borderRadius: radii.lg,
        flex: 1,
        gap: spacing[1],
        minHeight: 108,
        justifyContent: "flex-end",
        padding: spacing[4],
      }}
    >
      <AppText variant="h3">{label}</AppText>
      <AppText variant="bodySmall" tone="secondary">
        {subtitle}
      </AppText>
    </Pressable>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onPress,
}: {
  title: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  const { spacing } = useHungryTheme();

  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: spacing[2],
        justifyContent: "space-between",
      }}
    >
      <AppText variant="h2">{title}</AppText>
      {actionLabel && onPress ? (
        <Pressable onPress={onPress}>
          <AppText variant="bodySmall" tone="secondary">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
