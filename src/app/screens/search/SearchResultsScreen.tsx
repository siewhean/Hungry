import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";

import { AppText, Button, EmptyState, Screen } from "@/components/ui";
import { findBuildingById } from "@/features/discovery/discovery";
import { getSearchResults, sortSearchResults, type SearchSortMode, useSearchData } from "@/features/search/search";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

type DisplayMode = "list" | "grid";

function SearchResultListCard({ dish, onPress }: { dish: DishDetail; onPress: () => void }) {
  const { palette, radii, spacing } = useHungryTheme();
  const venue = mockRepository.getVenueById(dish.venueId);
  const building = findBuildingById(dish.buildingId);

  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: radii.lg,
          borderWidth: 1,
          gap: spacing[3],
          padding: spacing[3],
        }}
      >
        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <Image
            source={{ uri: dish.imageUrl }}
            style={{ borderRadius: radii.md, height: 96, width: 96 }}
            contentFit="cover"
          />
          <View style={{ flex: 1, gap: spacing[1] }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[3] }}>
              <View style={{ flex: 1 }}>
                <AppText variant="h3">{dish.name}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {venue?.name}
                </AppText>
              </View>
              <AppText variant="price">S${dish.price.toFixed(2)}</AppText>
            </View>
            <AppText variant="bodySmall" tone="secondary">
              {building?.name}
              {venue ? ` · ${venue.floor} ${venue.unitNumber}` : ""}
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              {dish.distanceMeters}m away · {dish.rating.toFixed(1)} rating
            </AppText>
            <AppText variant="bodySmall">{dish.tasteTags.slice(0, 2).join(" · ")}</AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function SearchResultGridCard({ dish, onPress }: { dish: DishDetail; onPress: () => void }) {
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: radii.lg,
          borderWidth: 1,
          overflow: "hidden",
        }}
      >
        <Image source={{ uri: dish.imageUrl }} style={{ height: 132, width: "100%" }} contentFit="cover" />
        <View style={{ gap: spacing[1], padding: spacing[3] }}>
          <AppText variant="h3" numberOfLines={1}>
            {dish.name}
          </AppText>
          <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
            {mockRepository.getVenueById(dish.venueId)?.name}
          </AppText>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <AppText variant="price">S${dish.price.toFixed(2)}</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {dish.rating.toFixed(1)}
            </AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function SearchResultsScreen() {
  const navigation = useNavigation<any>();
  const { palette, radii, spacing } = useHungryTheme();
  const { profile, filters, recentSearches } = useSearchData();
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const updateQuery = useSearchStore((state) => state.updateQuery);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  const [sortMode, setSortMode] = useState<SearchSortMode>("best_match");
  const [isLoading, setIsLoading] = useState(true);
  const rawResults = useMemo(() => getSearchResults(filters, profile.tasteVector), [filters, profile.tasteVector]);
  const results = useMemo(() => sortSearchResults(rawResults, sortMode, profile.tasteVector), [profile.tasteVector, rawResults, sortMode]);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 160);
    return () => clearTimeout(timer);
  }, [results]);

  return (
    <Screen
      scroll={false}
      title="Search results"
      subtitle={isLoading ? "Finding dishes near you…" : `${results.length} dishes matched your current search.`}
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
                <AppText tone={selected ? "default" : "secondary"} style={{ fontFamily: "Nunito_600SemiBold" }}>
                  {mode === "list" ? "List" : "Grid"}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {recentSearches.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {recentSearches.slice(0, 3).map((term) => (
              <Pressable
                key={term}
                onPress={() => {
                  rememberSearch(term);
                  updateQuery(term);
                }}
                style={{
                  backgroundColor: palette.surface,
                  borderColor: filters.query === term ? palette.navy : palette.border,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                }}
              >
                <AppText variant="bodySmall" tone={filters.query === term ? "default" : "secondary"}>
                  {term}
                </AppText>
              </Pressable>
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
              <Pressable
                key={option.value}
                onPress={() => setSortMode(option.value as SearchSortMode)}
                style={{
                  borderColor: selected ? palette.orange : palette.border,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                }}
              >
                <AppText variant="bodySmall" tone={selected ? "accent" : "secondary"}>
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {isLoading ? (
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: spacing[8], gap: spacing[2] }}>
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
          contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
          columnWrapperStyle={displayMode === "grid" ? { gap: 12 } : undefined}
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
            <EmptyState
              title="No dishes found"
              body="Try a broader search term or return to Search to change the dish query."
              ctaLabel="Back to Search"
              onPress={() => navigation.navigate("SearchHome")}
            />
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
            <AppText variant="bodySmall" tone="accent">
              Search again for "{filters.query}"
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}
