import { Pressable, ScrollView, View, useWindowDimensions, Animated } from "react-native";
import { Image } from "expo-image";
import { ChevronRight, Map, MapPinned, Search, Shuffle, Star, Flame, Home, Compass, Utensils } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useMemo, type ReactNode, useRef } from "react";
import * as Haptics from "expo-haptics";

import { AppText, Button, Chip, Input, Screen } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { SearchCategory } from "@/types/domain";

type IntentChip = {
  label: string;
  icon?: ReactNode;
  category?: SearchCategory;
  action?: "decide";
};

const INTENT_CHIPS: IntentChip[] = [
  { label: "Near me", icon: <MapPinned size={14} /> },
  { label: "Spicy", category: "local favourites", icon: <Flame size={14} /> },
  { label: "Best rated", category: "rice", icon: <Star size={14} /> },
  { label: "Hawker", category: "noodles", icon: <Home size={14} /> },
  { label: "Decide for me", action: "decide", icon: <Compass size={14} /> },
];

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

  const nearestBuilding = useMemo(() => buildings[0], [buildings]);

  const searchBarAnim = useRef(new Animated.Value(0)).current;

  const handleDecideForMe = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const picked = mockRepository.getDecideForMe(profile.tasteVector);
    if (picked) {
      setDecideForMe(picked);
    }
    navigation.navigate("DecideForMeResult");
  };

  return (
    <Screen scroll={false}>
      {/* Header */}
      <View style={{ paddingLeft: spacing[2], paddingRight: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[1], backgroundColor: palette.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText variant="h1">Discover</AppText>
          <Pressable
            onPress={() => navigation.navigate("Maps")}
            style={{
              width: 44, height: 44, borderRadius: radii.md, backgroundColor: palette.orangeLight,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Map color={palette.orange} size={20} />
          </Pressable>
        </View>
        
        <Pressable 
          onPress={() => navigation.navigate("Maps")}
          style={{ flexDirection: "row", alignItems: "center", gap: spacing[1], marginTop: 2, marginBottom: spacing[1] }}
        >
          <AppText variant="bodySmall" style={{ color: palette.orange, fontWeight: "700" }}>
            Maxwell Food Centre • 42 stalls nearby
          </AppText>
          <ChevronRight color={palette.orange} size={14} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing[5], paddingBottom: spacing[12] }}>
        
        {/* Search Bar */}
        <Pressable 
          onPress={() => {
            Animated.timing(searchBarAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              navigation.navigate("SearchHome");
              searchBarAnim.setValue(0);
            });
          }} 
          style={{ paddingHorizontal: spacing[4] }}
        >
          <Animated.View style={{ 
            transform: [{ scale: searchBarAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }],
            opacity: searchBarAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] })
          }}>
            <View pointerEvents="none">
              <Input
                leftIcon={<Search color={palette.textMuted} size={18} />}
                placeholder="Dishes, stalls, or centres…"
                editable={false}
              />
            </View>
          </Animated.View>
        </Pressable>

        {/* Intent Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2], paddingHorizontal: spacing[4] }}>
          {INTENT_CHIPS.map((chip) => (
            <Chip
              key={chip.label}
              label={chip.label}
              leftIcon={chip.icon}
              selected={chip.category ? selectedCategories.includes(chip.category) : false}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (chip.category) toggleCategory(chip.category);
                else if (chip.action === "decide") handleDecideForMe();
              }}
            />
          ))}
        </ScrollView>

        {/* Two large targets */}
        <View style={{ flexDirection: "row", gap: spacing[3], paddingHorizontal: spacing[4] }}>
          <QuickLinkCard
            label="Stalls"
            subtitle="Browse by venue"
            icon={<Utensils size={24} color={palette.orange} />}
            onPress={() => navigation.navigate("Maps")}
          />
          <QuickLinkCard
            label="Dishes"
            subtitle="Find cravings first"
            icon={<Search size={24} color={palette.orange} />}
            onPress={() => navigation.navigate("SearchHome")}
          />
        </View>

        {/* Decide for Me prominent card */}
        <View style={{ paddingHorizontal: spacing[4], gap: spacing[3] }}>
          <Pressable
            onPress={handleDecideForMe}
            style={[
              shadows.card,
              {
                backgroundColor: palette.orangeLight,
                borderColor: palette.orange,
                borderWidth: 1,
                borderRadius: radii.lg,
                flexDirection: "row",
                alignItems: "center",
                padding: spacing[4],
                gap: spacing[4],
              },
            ]}
          >
            <View style={{ backgroundColor: palette.orange, width: 48, height: 48, borderRadius: radii.md, alignItems: "center", justifyContent: "center" }}>
              <Shuffle color="#FFFFFF" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="h3">Decide for Me</AppText>
              <AppText variant="bodySmall" tone="secondary">Single-player choice engine</AppText>
            </View>
            <ChevronRight color={palette.orange} size={20} />
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("WheelStack")}
            style={[
              shadows.card,
              {
                backgroundColor: palette.bgSoft,
                borderColor: palette.border,
                borderWidth: 1,
                borderRadius: radii.lg,
                flexDirection: "row",
                alignItems: "center",
                padding: spacing[4],
                gap: spacing[4],
              },
            ]}
          >
            <View style={{ backgroundColor: palette.navy, width: 48, height: 48, borderRadius: radii.md, alignItems: "center", justifyContent: "center" }}>
              <Compass color="#FFFFFF" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="h3">Hungry Wheel</AppText>
              <AppText variant="bodySmall" tone="secondary">Group dining decision party</AppText>
            </View>
            <ChevronRight color={palette.textMuted} size={20} />
          </Pressable>
        </View>

        {/* Trending dishes */}
        <View style={{ gap: spacing[3] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing[4] }}>
            <AppText variant="h2">Trending near you</AppText>
            <Pressable onPress={() => navigation.navigate("SearchResults")}>
              <AppText variant="bodySmall" tone="secondary">See all</AppText>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[3], paddingHorizontal: spacing[4] }}
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
                    width: 160,
                  },
                ]}
              >
                <Image source={{ uri: dish.imageUrl }} style={{ height: 120, width: "100%" }} contentFit="cover" />
                <View style={{ padding: spacing[3], gap: spacing[1] }}>
                  <AppText variant="h3" numberOfLines={1}>{dish.name}</AppText>
                  <AppText variant="micro" tone="secondary" numberOfLines={1}>{dish.venueName}</AppText>
                  <AppText variant="price" style={{ color: palette.orange }}>S${dish.price.toFixed(2)}</AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Stalls near you */}
        <View style={{ gap: spacing[3], paddingHorizontal: spacing[4] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <AppText variant="h2">Stalls near you</AppText>
            <Pressable onPress={() => navigation.navigate("Maps")}>
              <AppText variant="bodySmall" tone="secondary">Map view</AppText>
            </Pressable>
          </View>
          {nearbyVenues.map(({ building, venue, topDish }) => (
            <Pressable
              key={venue.id}
              onPress={() => navigation.navigate("MapZoomedIn", { buildingId: building.id })}
              style={[
                shadows.card,
                {
                  backgroundColor: palette.surface,
                  borderRadius: radii.lg,
                  padding: spacing[3],
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[3],
                },
              ]}
            >
              <View style={{ position: "relative" }}>
                <Image
                  source={{ uri: topDish?.imageUrl ?? undefined }}
                  style={{ borderRadius: radii.md, height: 64, width: 64, borderWidth: 2, borderColor: palette.orange }}
                  contentFit="cover"
                />
                <View style={{ position: "absolute", bottom: -2, right: -2, backgroundColor: palette.bg, borderRadius: 8, padding: 1 }}>
                  <Utensils color={palette.orange} size={8} />
                </View>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="h3">{venue.name}</AppText>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: venue.isOpen ? palette.success : palette.error }} />
                  <AppText variant="micro" tone="secondary">{venue.isOpen ? "Open" : "Closed"} · {building.name} · 80m</AppText>
                </View>
              </View>
              <View style={{ backgroundColor: palette.bgSoft, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
                <AppText style={{ fontSize: 12, fontWeight: "700" }}>A</AppText>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function QuickLinkCard({ label, subtitle, icon, onPress }: { label: string; subtitle: string; icon: ReactNode; onPress: () => void }) {
  const { palette, radii, spacing, shadows } = useHungryTheme();
  return (
    <Pressable
      onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={[
        shadows.card,
        {
          backgroundColor: palette.surface,
          borderRadius: radii.lg,
          flex: 1,
          padding: spacing[4],
          gap: spacing[2],
          minHeight: 120,
        },
      ]}
    >
      <View style={{ marginBottom: spacing[1] }}>{icon}</View>
      <View>
        <AppText variant="h3">{label}</AppText>
        <AppText variant="micro" tone="secondary">{subtitle}</AppText>
      </View>
    </Pressable>
  );
}
