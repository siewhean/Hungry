import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Star } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, EmptyState, Screen, Chip } from "@/components/ui";
import { findBuildingById } from "@/features/discovery/discovery";
import {
  getSearchResults,
  sortSearchResults,
  type SearchSortMode,
  useSearchData,
} from "@/features/search/search";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

type DisplayMode = "list" | "grid";
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

function SearchResultListCard({ dish, onPress }: { dish: DishDetail; onPress: () => void }) {
  const repository = getDataRepository();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const venue = repository.getVenueById(dish.venueId);
  const building = findBuildingById(dish.buildingId);

  return (
    <Pressable onPress={onPress}>
      <View
        style={[
          shadows.card,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radii.lg,
            borderWidth: 1,
            gap: spacing[3],
            padding: spacing[3],
          },
        ]}
      >
        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <Image
            source={{ uri: dish.imageUrl }}
            style={{ borderRadius: radii.md, height: 96, width: 96 }}
            contentFit="cover"
          />
          <View style={{ flex: 1, gap: spacing[1] }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: spacing[3],
              }}
            >
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: "800", fontSize: 16 }}>{dish.name}</AppText>
                <AppText variant="micro" tone="secondary">
                  {venue?.name}
                </AppText>
              </View>
              <AppText style={{ fontWeight: "800", color: palette.orange }}>
                S${dish.price.toFixed(2)}
              </AppText>
            </View>
            <AppText variant="micro" tone="secondary">
              {building?.name}
              {venue ? ` · ${venue.floor} ${venue.unitNumber}` : ""}
            </AppText>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[2],
                marginTop: spacing[1],
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[1],
                }}
              >
                <Star color={palette.amber} fill={palette.amber} size={12} />
                <AppText variant="micro" style={{ fontWeight: "700" }}>
                  {dish.rating.toFixed(1)}
                </AppText>
              </View>
              <AppText variant="micro" tone="secondary">
                · {dish.distanceMeters}m away
              </AppText>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function SearchResultGridCard({ dish, onPress }: { dish: DishDetail; onPress: () => void }) {
  const repository = getDataRepository();
  const { palette, radii, spacing, shadows } = useHungryTheme();

  return (
    <Pressable onPress={onPress} style={{ width: "47%" }}>
      <View
        style={[
          shadows.card,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radii.lg,
            borderWidth: 1,
            overflow: "hidden",
          },
        ]}
      >
        <Image
          source={{ uri: dish.imageUrl }}
          style={{ height: 120, width: "100%" }}
          contentFit="cover"
        />
        <View style={{ gap: spacing[1], padding: spacing[3] }}>
          <AppText style={{ fontWeight: "800", fontSize: 14 }} numberOfLines={1}>
            {dish.name}
          </AppText>
          <AppText variant="micro" tone="secondary" numberOfLines={1}>
            {repository.getVenueById(dish.venueId)?.name}
          </AppText>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: spacing[1],
            }}
          >
            <AppText style={{ color: palette.orange, fontWeight: "800", fontSize: 13 }}>
              S${dish.price.toFixed(2)}
            </AppText>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[1],
              }}
            >
              <Star color={palette.amber} fill={palette.amber} size={10} />
              <AppText variant="micro" style={{ fontWeight: "700" }}>
                {dish.rating.toFixed(1)}
              </AppText>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function SearchResultsScreen() {
  const navigation = useNavigation<RootNavigation>();
  const { palette, radii, spacing } = useHungryTheme();
  const { profile, filters, recentSearches } = useSearchData();
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const updateQuery = useSearchStore((state) => state.updateQuery);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  const [sortMode, setSortMode] = useState<SearchSortMode>("best_match");
  const [isLoading, setIsLoading] = useState(true);
  const rawResults = useMemo(
    () => getSearchResults(filters, profile.tasteVector),
    [filters, profile.tasteVector],
  );
  const results = useMemo(
    () => sortSearchResults(rawResults, sortMode, profile.tasteVector),
    [profile.tasteVector, rawResults, sortMode],
  );

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 160);
    return () => clearTimeout(timer);
  }, [results]);

  return (
    <Screen
      scroll={false}
      title="Search results"
      subtitle={
        isLoading
          ? "Finding dishes near you…"
          : results.length > 0
            ? `${results.length} dishes matched your current search.`
            : undefined
      }
    >
      <View style={{ flex: 1, gap: spacing[4] }}>
        <View
          style={{
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radii.lg,
            borderWidth: 1,
            flexDirection: "row",
            padding: 4,
          }}
        >
          {(["list", "grid"] as const).map((mode) => {
            const selected = displayMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setDisplayMode(mode)}
                style={{
                  alignItems: "center",
                  backgroundColor: selected ? palette.bgSoft : "transparent",
                  borderRadius: radii.md,
                  flex: 1,
                  minHeight: 44,
                  justifyContent: "center",
                }}
              >
                <AppText tone={selected ? "default" : "secondary"} style={{ fontWeight: "700" }}>
                  {mode === "list" ? "List" : "Grid"}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {recentSearches.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {recentSearches.slice(0, 3).map((term) => (
              <Chip
                key={term}
                label={term}
                selected={filters.query === term}
                onPress={() => {
                  rememberSearch(term);
                  updateQuery(term);
                }}
              />
            ))}
          </View>
        ) : null}

        <Button
          label="Taste filter"
          variant="secondary"
          onPress={() => navigation.navigate("TasteFilter")}
        />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          {[
            { label: "Best match", value: "best_match" },
            { label: "Nearest", value: "distance" },
            { label: "Top rated", value: "rating" },
            { label: "Cheapest", value: "price" },
          ].map((option) => {
            const selected = sortMode === option.value;
            return (
              <Chip
                key={option.value}
                label={option.label}
                selected={selected}
                onPress={() => setSortMode(option.value as SearchSortMode)}
              />
            );
          })}
        </View>

        {isLoading ? (
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: spacing[8],
              gap: spacing[2],
            }}
          >
            <ActivityIndicator color={palette.orange} />
            <AppText variant="bodySmall" tone="secondary">
              Updating results…
            </AppText>
          </View>
        ) : null}

        <FlatList
          style={{ opacity: isLoading ? 0.35 : 1 }}
          key={displayMode}
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={displayMode === "grid" ? 2 : 1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 16, paddingBottom: spacing[24] }}
          columnWrapperStyle={
            displayMode === "grid" ? { justifyContent: "space-between" } : undefined
          }
          renderItem={({ item }) =>
            displayMode === "list" ? (
              <SearchResultListCard
                dish={item}
                onPress={() => {
                  rememberSearch(filters.query);
                  navigation.navigate("DishDetail", { dishId: item.id });
                }}
              />
            ) : (
              <SearchResultGridCard
                dish={item}
                onPress={() => {
                  rememberSearch(filters.query);
                  navigation.navigate("DishDetail", { dishId: item.id });
                }}
              />
            )
          }
          ListEmptyComponent={
            <View style={{ gap: spacing[4] }}>
              <EmptyState
                title="No dishes found"
                body="Try adjusting your taste filters or searching for something else."
                ctaLabel="Adjust Taste Filters"
                onPress={() => navigation.navigate("TasteFilter")}
              />
              <Button
                label="Explore Popular Nearby"
                variant="secondary"
                onPress={() => {
                  updateQuery("");
                  navigation.navigate("SearchHome");
                }}
              />
            </View>
          }
        />

        {filters.query ? (
          <Pressable
            onPress={() => {
              rememberSearch(filters.query);
              updateQuery(filters.query);
              navigation.navigate("SearchHome");
            }}
            style={{ alignSelf: "flex-start", paddingVertical: spacing[2] }}
          >
            <AppText variant="bodySmall" tone="accent" style={{ fontWeight: "700" }}>
              Search again for "{filters.query}"
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}
