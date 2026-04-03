import { useMemo } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";

import { AppText, Badge, Button, EmptyState, Screen } from "@/components/ui";
import { findBuildingById } from "@/features/discovery/discovery";
import { getSearchResults, useSearchData } from "@/features/search/search";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

function SearchResultCard({
  dish,
  onPress,
}: {
  dish: DishDetail;
  onPress: () => void;
}) {
  const venue = mockRepository.getVenueById(dish.venueId);
  const building = findBuildingById(dish.buildingId);

  return (
    <Pressable onPress={onPress}>
      <View style={{ borderColor: "#D1D5DB", borderRadius: 14, borderWidth: 1, padding: 12, gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Image source={{ uri: dish.imageUrl }} style={{ borderRadius: 12, height: 84, width: 84 }} contentFit="cover" />
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
              {venue ? ` • ${venue.floor} ${venue.unitNumber}` : ""}
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              {dish.distanceMeters}m away • {dish.rating.toFixed(1)} rating
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

export function SearchResultsScreen() {
  const navigation = useNavigation<any>();
  const { spacing } = useHungryTheme();
  const { profile, filters } = useSearchData();
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const results = useMemo(() => getSearchResults(filters, profile.tasteVector), [filters, profile.tasteVector]);

  return (
    <Screen title="Search results" subtitle={`${results.length} dishes matched your filters.`}>
      <View style={{ gap: spacing[4] }}>
        <Button label="Taste filters" variant="secondary" onPress={() => navigation.navigate("TasteFilter")} />
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <SearchResultCard
              dish={item}
              onPress={() => {
                rememberSearch(filters.query);
                setDecideForMe(item);
                navigation.navigate("DecideForMeResult");
              }}
            />
          )}
          ListEmptyComponent={<EmptyState title="No dishes found" body="Try widening the radius or clearing some filters." />}
        />
      </View>
    </Screen>
  );
}
