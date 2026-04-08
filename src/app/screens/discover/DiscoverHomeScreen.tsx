import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Compass, MapPinned, Search, Sparkles } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

import { AppText, Badge, Card, Chip, Screen } from "@/components/ui";
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

  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set(["Spicy"]));

  const buildings = mockRepository.listBuildings();
  const stallVenues = buildings
    .slice(0, 4)
    .map((building) => {
      const venue = mockRepository.listVenuesByBuilding(building.id)[0];
      const topDish = venue ? mockRepository.getDishById(venue.topDishId) : undefined;
      if (!venue) return null;
      return { building, venue, topDish };
    })
    .filter(Boolean) as Array<{
    building: (typeof buildings)[number];
    venue: NonNullable<ReturnType<typeof mockRepository.getVenueById>>;
    topDish: ReturnType<typeof mockRepository.getDishById>;
  }>;

  const recommendedDishes = popularNearby.slice(0, 3);
  const mapBuildings = buildings.slice(0, 3);

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
    <Screen scroll={false}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[5] }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing[2] }}>
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1, gap: spacing[1] }}>
              <AppText variant="micro" tone="accent" style={styles.sectionEyebrow}>
                DISCOVER
              </AppText>
              <AppText variant="h1">Find what actually sounds good right now.</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Search by dish, browse by centre, or let Hungry make the call.
              </AppText>
            </View>
            <Badge label="Near Maxwell" tone="success" />
          </View>
        </View>

        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: palette.surfaceRaised,
              borderColor: palette.border,
              borderWidth: 1,
              borderRadius: radii.pill,
              paddingHorizontal: spacing[4],
              gap: spacing[2],
            },
          ]}
        >
          <Search color={palette.textMuted} size={18} />
          <TextInput
            placeholder="laksa, briyani, late supper…"
            placeholderTextColor={palette.textMuted}
            style={[
              styles.searchInput,
              { color: palette.text, fontFamily: "Nunito_400Regular", fontSize: 15 },
            ]}
            onFocus={() => navigation.navigate("SearchHome")}
            onSubmitEditing={() => navigation.navigate("SearchResults")}
          />
        </View>

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
            onPress={() => navigation.navigate("MainTabs", { screen: "Maps" })}
          >
            <AppText variant="h3" style={styles.quickAccessLabel}>
              Stalls
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              Browse by centre
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
            onPress={() => navigation.navigate("SearchHome")}
          >
            <AppText variant="h3" style={styles.quickAccessLabel}>
              Dishes
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              Jump to search
            </AppText>
          </Pressable>
        </View>

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

        <View style={{ gap: spacing[3] }}>
          <View style={styles.sectionHeader}>
            <View>
              <AppText variant="micro" tone="accent" style={styles.sectionEyebrow}>
                TRENDING RIGHT NOW
              </AppText>
              <AppText variant="h2">Recommended dishes</AppText>
            </View>
            <Sparkles color={palette.orange} size={18} />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[3] }}
          >
            {recommendedDishes.map((dish) => (
              <Pressable
                key={dish.id}
                onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
              >
                <View
                  style={[
                    styles.dishCard,
                    shadows.card,
                    {
                      borderRadius: radii.md,
                      overflow: "hidden",
                      width: 214,
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
                    <AppText variant="bodySmall" tone="inverse" style={{ opacity: 0.84 }}>
                      {dish.tasteTags.slice(0, 2).join(" · ")}
                    </AppText>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <Pressable onPress={() => navigation.navigate("Maps" as any)}>
          <Card
            style={{
              backgroundColor: palette.surfaceRaised,
              borderColor: palette.border,
              gap: spacing[3],
            }}
          >
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1, gap: spacing[1] }}>
                <AppText variant="micro" tone="accent" style={styles.sectionEyebrow}>
                  MAP BROWSE
                </AppText>
                <AppText variant="h2">Browse by building and floor</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Open the nearby map, tap a hawker centre or food court, then drill into the stalls on each level.
                </AppText>
              </View>
              <MapPinned color={palette.orange} size={22} />
            </View>

            <View style={[styles.mapTeaser, { borderRadius: radii.lg, borderColor: palette.border }]}>
              {mapBuildings.map((building, index) => (
                <View
                  key={building.id}
                  style={[
                    styles.mapPin,
                    {
                      backgroundColor: building.type === "food_court" ? palette.success : palette.orange,
                      top: index === 0 ? "22%" : index === 1 ? "52%" : "32%",
                      left: index === 0 ? "18%" : index === 1 ? "58%" : "72%",
                    },
                  ]}
                />
              ))}
              <View style={[styles.mapSheet, shadows.card, { borderRadius: radii.md, padding: spacing[3] }]}>
                <AppText variant="body">3 centres nearby</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Maxwell, Lau Pa Sat, and Amoy Street
                </AppText>
              </View>
            </View>
          </Card>
        </Pressable>

        <View style={{ gap: spacing[3] }}>
          <View style={styles.sectionHeader}>
            <AppText variant="h2">Stalls near you</AppText>
            <Pressable onPress={() => navigation.navigate("MainTabs", { screen: "Maps" })}>
              <AppText variant="body" tone="accent">
                View map
              </AppText>
            </Pressable>
          </View>

          {stallVenues.map(({ building, venue, topDish }) => {
            const displayDish = topDish;
            const distance = displayDish ? formatDistance(displayDish.distanceMeters) : "";

            return (
              <Pressable
                key={venue.id}
                onPress={() => navigation.navigate("StallDetail", { venueId: venue.id })}
              >
                <Card style={{ padding: 0, overflow: "hidden", gap: 0 }}>
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
                        { backgroundColor: palette.orangeLight, borderRadius: radii.pill },
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
                      <AppText variant="bodySmall" tone="secondary">
                        {building.name} {venue.unitNumber}
                        {distance ? ` · ${distance}` : ""}
                      </AppText>
                    </View>
                    <Badge label={venue.isOpen ? "Open" : "Closed"} tone={venue.isOpen ? "success" : "warning"} />
                  </View>

                  {displayDish ? (
                    <Image
                      source={{ uri: displayDish.imageUrl }}
                      style={styles.stallDishImage}
                      contentFit="cover"
                    />
                  ) : null}
                </Card>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={() => navigation.navigate("ReadsFeed")}>
          <Card
            style={{
              backgroundColor: palette.surfaceRaised,
              borderColor: palette.border,
              gap: spacing[2],
            }}
          >
            <AppText variant="micro" tone="accent" style={styles.sectionEyebrow}>
              READS
            </AppText>
            <AppText variant="h2">Open local food stories</AppText>
            <AppText variant="bodySmall" tone="secondary">
              Browse article picks, save context for later, then jump back into the relevant stall.
            </AppText>
          </Card>
        </Pressable>
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
    height: 48,
  },
  searchInput: {
    flex: 1,
  },
  quickAccessRow: {
    flexDirection: "row",
  },
  quickAccessButton: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
  },
  quickAccessLabel: {
    textAlign: "center",
  },
  compassIcon: {
    alignItems: "center",
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  dishCard: {
    backgroundColor: "#111827",
  },
  dishImage: {
    height: 180,
    width: "100%",
  },
  dishOverlay: {
    backgroundColor: "rgba(17,24,39,0.46)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionEyebrow: {
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  mapTeaser: {
    backgroundColor: "#FFFDF9",
    borderWidth: 1,
    height: 176,
    overflow: "hidden",
    position: "relative",
  },
  mapPin: {
    borderColor: "#FFFFFF",
    borderRadius: 11,
    borderWidth: 3,
    height: 22,
    position: "absolute",
    width: 22,
  },
  mapSheet: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E7DED4",
    borderWidth: 1,
    bottom: 12,
    left: 12,
    position: "absolute",
    right: 12,
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
    height: 140,
    width: "100%",
  },
});
