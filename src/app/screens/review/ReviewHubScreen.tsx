import { FlatList, Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppText, Badge, Card, Input, Screen } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useHungryTheme } from "@/theme";
import type { ReviewStackParamList } from "./ReviewStack";
import { useState } from "react";

type Props = NativeStackScreenProps<ReviewStackParamList, "ReviewHub">;

export function ReviewHubScreen({ navigation }: Props) {
  const { spacing } = useHungryTheme();
  const selectDish = useReviewDraftStore((state) => state.selectDish);
  const [query, setQuery] = useState("");
  const venues = mockRepository
    .listBuildings()
    .flatMap((building) => mockRepository.listVenuesByBuilding(building.id))
    .filter((venue) =>
      `${venue.name} ${venue.unitNumber}`.toLowerCase().includes(query.trim().toLowerCase()),
    );

  return (
    <Screen
      title="Review"
      subtitle="Choose the stall, then pick the dish you bought and rate it."
      scroll={false}
    >
      <FlatList
        data={venues}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing[4], paddingBottom: spacing[8] }}
        ListHeaderComponent={
          <Input
            label="Search for a stall"
            placeholder="Tian Tian, Satay Street..."
            value={query}
            onChangeText={setQuery}
          />
        }
        renderItem={({ item }) => {
          const dishes = mockRepository.listDishesByVenue(item.id);
          return (
            <Card>
              <View style={{ gap: spacing[2] }}>
                <AppText variant="h3">{item.name}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {item.floor} {item.unitNumber} · {item.operatingHours}
                </AppText>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                {dishes.map((dish) => (
                  <Pressable
                    key={dish.id}
                    onPress={() => {
                      selectDish(item.id, dish.id);
                      navigation.navigate("ReviewRating", { venueId: item.id, dishId: dish.id });
                    }}
                  >
                    <Badge label={dish.name} tone="orange" />
                  </Pressable>
                ))}
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}
