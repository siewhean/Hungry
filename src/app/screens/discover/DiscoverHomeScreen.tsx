import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Compass, Search } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

import { AppText, Card, Chip, Screen } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";

const FILTER_CHIPS = ["Spicy", "Halal", "Late night", "Cheap"] as const;

export function DiscoverHomeScreen() {
  const navigation = useNavigation<any>();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const profile = useProfileStore((s) => s.profile);
  const { popularNearby, setDecideForMe } = useDiscoveryStore();

  const [selectedChips, setSelectedChips] = useState<Set<string>>(
    new Set(["Spicy"]),
  );

  const buildings = mockRepository.listBuildings();
  const stallVenues = buildings
    .slice(0, 3)
    .map((b) => {
      const venues = mockRepository.listVenuesByBuilding(b.id);
      const venue = venues[0];
      if (!venue) return null;
      const topDish = mockRepository.getDishById(venue.topDishId);
      return { building: b, venue, topDish };
    })
    .filter(Boolean) as NonNullable<
    { building: (typeof buildings)[0]; venue: ReturnType<typeof mockRepository.getVenueById>; topDish: ReturnType<typeof mockRepository.getDishById> }
  >[];

  const recommendedDishes = popularNearby.slice(0, 2);

  function toggleChip(label: string) {
    setSelectedChips((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  function handleDecideForMe() {
    const picked = mockRepository.getDecideForMe(profile.tasteVector);
    if (picked) {
      setDecideForMe(picked);
    }
    navigation.navigate("DecideForMeResult");
  }

  function formatDistance(meters: number) {
    if (meters < 1000) return `${meters}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  }

  return (
    <Screen title="Discover" scroll={false}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[5] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Search bar */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: palette.bgMuted,
              borderRadius: radii.pill,
              paddingHorizontal: spacing[4],
              gap: spacing[2],
            },
          ]}
        >
          <Search color={palette.textMuted} size={18} />
          <TextInput
            placeholder="laksa, briyani, late supper\u2026"
            placeholderTextColor={palette.textMuted}
            style={[
              styles.searchInput,
              { color: palette.text, fontFamily: "Nunito_400Regular", fontSize: 15 },
            ]}
          />
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[2] }}
        >
          {FILTER_CHIPS.map((label) => (
            <Chip
              key={label}
              label={label}
              selected={selectedChips.has(label)}
              onPress={() => toggleChip(label)}
            />
          ))}
        </ScrollView>

        {/* Quick access row */}
        <View style={[styles.quickAccessRow, { gap: spacing[3] }]}>
          <Pressable
            style={[
              styles.quickAccessButton,
              {
                borderColor: palette.border,
                borderRadius: radii.md,
                paddingVertical: spacing[4],
              },
            ]}
            onPress={() => navigation.navigate("Maps" as any)}
          >
            <AppText variant="h3" style={styles.quickAccessLabel}>
              {"\uD83C\uDF7D"} Stalls
            </AppText>
          </Pressable>
          <Pressable
            style={[
              styles.quickAccessButton,
              {
                borderColor: palette.border,
                borderRadius: radii.md,
                paddingVertical: spacing[4],
              },
            ]}
            onPress={() => navigation.navigate("SearchResults" as any)}
          >
            <AppText variant="h3" style={styles.quickAccessLabel}>
              {"\uD83C\uDF74"} Dishes
            </AppText>
          </Pressable>
        </View>

        {/* Decide For Me CTA */}
        <Pressable onPress={handleDecideForMe}>
          <Card
            style={{
              backgroundColor: palette.orange,
              borderColor: palette.orange,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing[4],
            }}
          >
            <View
              style={[
                styles.compassIcon,
                {
                  backgroundColor: "rgba(255,255,255,0.2)",
                  borderRadius: radii.pill,
                },
              ]}
            >
              <Compass color={palette.bg} size={28} />
            </View>
            <View style={styles.flex}>
              <AppText variant="h2" tone="inverse">
                Decide For Me
              </AppText>
              <AppText variant="bodySmall" tone="inverse" style={{ opacity: 0.85 }}>
                Let our AI curator pick your next meal
              </AppText>
            </View>
          </Card>
        </Pressable>

        {/* Recommended Dishes */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h2">Recommended Dishes</AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[3] }}
          >
            {recommendedDishes.map((dish) => (
              <Pressable
                key={dish.id}
                onPress={() =>
                  navigation.navigate("DishDetail", { dishId: dish.id })
                }
              >
                <View
                  style={[
                    styles.dishCard,
                    shadows.card,
                    {
                      borderRadius: radii.md,
                      overflow: "hidden",
                      width: 200,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: dish.imageUrl }}
                    style={styles.dishImage}
                    contentFit="cover"
                  />
                  <View
                    style={[
                      styles.dishOverlay,
                      {
                        borderBottomLeftRadius: radii.md,
                        borderBottomRightRadius: radii.md,
                        padding: spacing[3],
                        gap: 2,
                      },
                    ]}
                  >
                    <AppText variant="h3" tone="inverse" numberOfLines={1}>
                      {dish.name}
                    </AppText>
                    <AppText variant="bodySmall" tone="inverse" style={{ opacity: 0.8 }}>
                      {dish.tasteTags.slice(0, 2).join(" & ")}
                    </AppText>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Stalls Near You */}
        <View style={{ gap: spacing[3] }}>
          <View style={styles.sectionHeader}>
            <AppText variant="h2">Stalls Near You</AppText>
            <Pressable onPress={() => navigation.navigate("Maps" as any)}>
              <AppText variant="body" tone="accent">
                View Map
              </AppText>
            </Pressable>
          </View>

          {stallVenues.map(({ building, venue, topDish }) => {
            if (!venue) return null;
            const dishes = mockRepository.listDishesByVenue(venue.id);
            const displayDish = topDish ?? dishes[0];
            const distance = displayDish
              ? formatDistance(displayDish.distanceMeters)
              : "";

            return (
              <Pressable
                key={venue.id}
                onPress={() =>
                  navigation.navigate("StallDetail", { venueId: venue.id })
                }
              >
                <Card style={{ padding: 0, overflow: "hidden", gap: 0 }}>
                  {/* Stall info row */}
                  <View
                    style={[
                      styles.stallInfoRow,
                      {
                        padding: spacing[4],
                        gap: spacing[3],
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.stallAvatar,
                        {
                          backgroundColor: palette.orangeLight,
                          borderRadius: radii.pill,
                        },
                      ]}
                    >
                      <AppText variant="h3" tone="accent">
                        {venue.name.charAt(0)}
                      </AppText>
                    </View>
                    <View style={styles.flex}>
                      <AppText variant="h3" numberOfLines={1}>
                        {venue.name}
                      </AppText>
                      <AppText variant="bodySmall" tone="muted">
                        {building.name} {venue.unitNumber}
                        {distance ? ` \u00B7 ${distance}` : ""}
                      </AppText>
                    </View>
                  </View>

                  {/* Dish image */}
                  {displayDish && (
                    <Image
                      source={{ uri: displayDish.imageUrl }}
                      style={styles.stallDishImage}
                      contentFit="cover"
                    />
                  )}
                </Card>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  searchBar: {
    alignItems: "center",
    flexDirection: "row",
    height: 46,
  },
  searchInput: {
    flex: 1,
    height: "100%",
  },
  quickAccessRow: {
    flexDirection: "row",
  },
  quickAccessButton: {
    alignItems: "center",
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
  },
  quickAccessLabel: {
    textAlign: "center",
  },
  compassIcon: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  dishCard: {
    height: 200,
  },
  dishImage: {
    height: "100%",
    width: "100%",
  },
  dishOverlay: {
    backgroundColor: "rgba(17, 24, 39, 0.55)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stallInfoRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  stallAvatar: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  stallDishImage: {
    height: 180,
    width: "100%",
  },
});
