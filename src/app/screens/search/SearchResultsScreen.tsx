import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MapPinned, Star, Store, Utensils } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Screen } from "@/components/ui";
import { SearchResultsView } from "@/components/discover/SearchResultsView";
import { getNearestBuildings } from "@/lib/geo/singaporeBuildings";
import {
  getSearchResults,
  groupResultsByVenue,
  sortSearchResults,
  type SearchSortMode,
  useSearchData,
} from "@/features/search/search";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useLocationStore } from "@/store/useLocationStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
type SearchResultsRoute = RouteProp<RootStackParamList, "SearchResults">;

function BrowseGridScreen({ mode }: { mode: "dishes" | "stalls" }) {
  const navigation = useNavigation<RootNavigation>();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualLocation = useLocationStore((state) => state.manualLocation);
  const repository = getDataRepository();
  const areaBuildings = useMemo(
    () => getNearestBuildings(currentLocation.latitude, currentLocation.longitude, 3, 14),
    [currentLocation.latitude, currentLocation.longitude],
  );
  const areaLabel = manualLocation ?? areaBuildings[0]?.name ?? "Current area";
  const allVenues = useMemo(
    () =>
      repository
        .listBuildings()
        .flatMap((building) => repository.listVenuesByBuilding(building.id)),
    [repository],
  );
  const areaVenues = useMemo(() => {
    const scopedVenues = areaBuildings.flatMap((building) =>
      repository.listVenuesByBuilding(building.id),
    );
    const uniqueVenues = new Map(scopedVenues.map((venue) => [venue.id, venue]));
    return uniqueVenues.size ? Array.from(uniqueVenues.values()) : allVenues;
  }, [allVenues, areaBuildings, repository]);
  const browseDishes = useMemo(
    () =>
      areaVenues
        .flatMap((venue) => repository.listDishesByVenue(venue.id))
        .sort((left, right) => right.rating - left.rating),
    [areaVenues, repository],
  );
  const browseVenues = useMemo(() => groupResultsByVenue(browseDishes), [browseDishes]);

  const isDishGrid = mode === "dishes";
  const title = isDishGrid ? `Dishes in ${areaLabel}` : `Stalls & restaurants in ${areaLabel}`;
  const subtitle = isDishGrid
    ? `Showing dishes available around ${areaLabel}.`
    : `Showing stalls and restaurants around ${areaLabel}.`;

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[2], gap: spacing[1] }}>
          <AppText variant="h1" style={{ color: palette.text }}>
            {title}
          </AppText>
          <AppText variant="bodySmall" style={{ color: palette.textSecondary }}>
            {subtitle}
          </AppText>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing[3],
            padding: spacing[4],
            paddingBottom: spacing[8],
          }}
        >
          {isDishGrid
            ? browseDishes.map((dish) => (
                <Pressable
                  key={dish.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${dish.name}`}
                  onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                  style={[
                    shadows.card,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      borderRadius: radii.lg,
                      borderWidth: 1,
                      overflow: "hidden",
                      width: "47.8%",
                    },
                  ]}
                >
                  <Image
                    source={{ uri: dish.imageUrl }}
                    style={{ aspectRatio: 1, width: "100%" }}
                    contentFit="cover"
                  />
                  <View style={{ gap: spacing[1], padding: spacing[3] }}>
                    <AppText variant="bodySmallBold" numberOfLines={2}>
                      {dish.name}
                    </AppText>
                    <AppText variant="micro" tone="secondary" numberOfLines={1}>
                      {dish.venueName}
                    </AppText>
                    <View
                      style={{
                        alignItems: "center",
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <AppText variant="price" style={{ color: palette.orange }}>
                        S${dish.price.toFixed(2)}
                      </AppText>
                      <View
                        style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}
                      >
                        <Star color={palette.amber} fill={palette.amber} size={12} />
                        <AppText variant="micro" style={{ fontWeight: "800" }}>
                          {dish.rating.toFixed(1)}
                        </AppText>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))
            : browseVenues.map(({ venue, dishes, minDistanceMeters }) => {
                const topDish = dishes[0];
                return (
                  <Pressable
                    key={venue.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${venue.name}`}
                    onPress={() => navigation.navigate("StallDetail", { venueId: venue.id })}
                    style={[
                      shadows.card,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                        borderRadius: radii.lg,
                        borderWidth: 1,
                        overflow: "hidden",
                        width: "47.8%",
                      },
                    ]}
                  >
                    {topDish ? (
                      <Image
                        source={{ uri: topDish.imageUrl }}
                        style={{ aspectRatio: 1, width: "100%" }}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={{
                          alignItems: "center",
                          aspectRatio: 1,
                          backgroundColor: palette.bgSoft,
                          justifyContent: "center",
                          width: "100%",
                        }}
                      >
                        <Store color={palette.orange} size={30} />
                      </View>
                    )}
                    <View style={{ gap: spacing[1], padding: spacing[3] }}>
                      <AppText variant="bodySmallBold" numberOfLines={2}>
                        {venue.name}
                      </AppText>
                      <View
                        style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}
                      >
                        <MapPinned color={palette.textMuted} size={12} />
                        <AppText variant="micro" tone="secondary" numberOfLines={1}>
                          {venue.unitNumber}
                        </AppText>
                      </View>
                      <View
                        style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}
                      >
                        <Utensils color={palette.orange} size={12} />
                        <AppText
                          variant="micro"
                          style={{ color: palette.orange, fontWeight: "800" }}
                        >
                          {dishes.length} dishes
                        </AppText>
                        <AppText variant="micro" tone="secondary">
                          {Math.round(minDistanceMeters)}m
                        </AppText>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
        </ScrollView>
      </View>
    </Screen>
  );
}

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
  const rawResults = useMemo(
    () => getSearchResults(filters, profile.tasteVector),
    [filters, profile.tasteVector],
  );
  const results = useMemo(
    () => sortSearchResults(rawResults, sortMode, profile.tasteVector),
    [profile.tasteVector, rawResults, sortMode],
  );

  if (browseMode) {
    return <BrowseGridScreen mode={browseMode} />;
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
