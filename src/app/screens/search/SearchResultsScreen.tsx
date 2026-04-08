import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";

import { AppText, Badge, Button, EmptyState, Screen } from "@/components/ui";
import { findBuildingById } from "@/features/discovery/discovery";
import { getSearchResults, useSearchData } from "@/features/search/search";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

type DisplayMode = "list" | "grid";

function SearchResultListCard({ dish, onPress }: { dish: DishDetail; onPress: () => void }) {
  const { palette } = useHungryTheme();
  const venue = mockRepository.getVenueById(dish.venueId);
  const building = findBuildingById(dish.buildingId);

  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: 18,
          borderWidth: 1,
          gap: 10,
          padding: 12,
        }}
      >
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Image source={{ uri: dish.imageUrl }} style={{ borderRadius: 12, height: 88, width: 88 }} contentFit="cover" />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
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
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {dish.tasteTags.slice(0, 2).map((tag) => (
                <Badge key={tag} label={tag} tone="amber" />
              ))}
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function SearchResultGridCard({ dish, onPress }: { dish: DishDetail; onPress: () => void }) {
  const { palette } = useHungryTheme();

  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: 18,
          borderWidth: 1,
          overflow: "hidden",
        }}
      >
        <Image source={{ uri: dish.imageUrl }} style={{ height: 132, width: "100%" }} contentFit="cover" />
        <View style={{ gap: 6, padding: 12 }}>
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
  const { spacing } = useHungryTheme();
  const { profile, filters, recentSearches } = useSearchData();
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const updateQuery = useSearchStore((state) => state.updateQuery);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  const results = useMemo(() => getSearchResults(filters, profile.tasteVector), [filters, profile.tasteVector]);

  return (
    <Screen scroll={false} title="Search results" subtitle={`${results.length} dishes matched your current search.`}>
      <View style={{ flex: 1, gap: spacing[4] }}>
        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          <Button
            label="List"
            fullWidth={false}
            variant={displayMode === "list" ? "primary" : "secondary"}
            onPress={() => setDisplayMode("list")}
            style={{ flex: 1 }}
          />
          <Button
            label="Grid"
            fullWidth={false}
            variant={displayMode === "grid" ? "primary" : "secondary"}
            onPress={() => setDisplayMode("grid")}
            style={{ flex: 1 }}
          />
        </View>

        {recentSearches.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {recentSearches.slice(0, 3).map((term) => (
              <Badge key={term} label={term} tone={filters.query === term ? "orange" : "neutral"} />
            ))}
          </View>
        ) : null}

        <FlatList
          key={displayMode}
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={displayMode === "grid" ? 2 : 1}
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
          <Button
            label={`Search again for “${filters.query}”`}
            variant="ghost"
            onPress={() => {
              rememberSearch(filters.query);
              updateQuery(filters.query);
              navigation.navigate("SearchHome");
            }}
          />
        ) : null}
      </View>
    </Screen>
  );
}
