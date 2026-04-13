import { useEffect, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { Search, FileEdit, Clock } from "lucide-react-native";

import { AppText, Badge, Card, EmptyState, Input, Screen } from "@/components/ui";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import type { ReviewStackParamList } from "./ReviewStack";

type Props = NativeStackScreenProps<ReviewStackParamList, "ReviewHub">;

export function ReviewHubScreen({ navigation }: Props) {
  const repository = getDataRepository();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const rootNavigation = navigation.getParent()?.getParent();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const selectDish = useReviewDraftStore((state) => state.selectDish);
  const draft = useReviewDraftStore((state) => state.draft);
  const [query, setQuery] = useState("");
  const venues = repository
    .listBuildings()
    .flatMap((building) => repository.listVenuesByBuilding(building.id))
    .filter((venue) =>
      `${venue.name} ${venue.unitNumber}`.toLowerCase().includes(query.trim().toLowerCase()),
    );

  const hasActiveDraft = !!(draft.selectedDishId || draft.text || draft.photos.length > 0);

  useEffect(() => {
    if (!isAuthenticated) {
      setReturnRoute("Review");
      rootNavigation?.navigate("AuthStack", { screen: "Login" });
    }
  }, [isAuthenticated, rootNavigation, setReturnRoute]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Screen
      title="Quick review"
      subtitle="Start with the exact dish so every review stays attached to what you actually ate."
      scroll={false}
    >
      <FlatList
        data={venues}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[4], paddingBottom: spacing[20] }}
        ListHeaderComponent={
          <View style={{ gap: spacing[4], paddingBottom: spacing[4] }}>
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderWidth: 1,
                borderRadius: radii.pill,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[1],
              }}
            >
              <AppText variant="micro" tone="accent" style={{ textTransform: "uppercase" }}>
                Step 1 of 4
              </AppText>
            </View>

            {hasActiveDraft && (
              <View style={{ gap: spacing[3], marginBottom: spacing[2] }}>
                <AppText variant="h3">Continue your draft</AppText>
                <Pressable
                  onPress={() => {
                    if (draft.selectedVenueId && draft.selectedDishId) {
                      navigation.navigate("ReviewRating", { 
                        venueId: draft.selectedVenueId, 
                        dishId: draft.selectedDishId 
                      });
                    }
                  }}
                  style={({ pressed }) => [
                    {
                      ...shadows.card,
                      backgroundColor: pressed ? palette.bgSoft : palette.surface,
                      borderRadius: radii.lg,
                      padding: spacing[4],
                      borderWidth: 1,
                      borderColor: palette.orange,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing[3],
                    },
                  ]}
                >
                  <View
                    style={{
                      backgroundColor: palette.orangeLight,
                      width: 40,
                      height: 40,
                      borderRadius: radii.md,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FileEdit size={20} color={palette.orange} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontWeight: "700" }}>Resume Review</AppText>
                    <AppText variant="micro" tone="secondary">
                      {draft.selectedDishId
                        ? repository.getDishById(draft.selectedDishId)?.name
                        : "Unnamed Dish"}{" "}
                      • Saved just now
                    </AppText>
                  </View>
                  <Clock size={16} color={palette.textMuted} />
                </Pressable>
              </View>
            )}

            <Input
              label="Search for a stall"
              placeholder="Tian Tian, Satay Street..."
              value={query}
              onChangeText={setQuery}
              leftIcon={<Search color={palette.textMuted} size={18} />}
            />
          </View>
        }
        renderItem={({ item }) => {
          const dishes = repository.listDishesByVenue(item.id);
          const leadDish = dishes[0];
          const handleCardPress = () => {
            if (!leadDish) {
              return;
            }
            selectDish(item.id, leadDish.id);
            navigation.navigate("ReviewRating", { venueId: item.id, dishId: leadDish.id });
          };

          return (
            <Pressable onPress={handleCardPress}>
              <Card style={{ padding: 0, overflow: "hidden" }}>
                {leadDish ? (
                  <Image
                    source={{ uri: leadDish.imageUrl }}
                    style={{ width: "100%", height: 132 }}
                    contentFit="cover"
                  />
                ) : null}
                <View style={{ padding: spacing[4], gap: spacing[3] }}>
                  <View style={{ gap: spacing[2] }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[3] }}>
                      <View style={{ flex: 1 }}>
                        <AppText variant="h3">{item.name}</AppText>
                        <AppText variant="bodySmall" tone="secondary">
                          {item.floor} {item.unitNumber} · {item.operatingHours}
                        </AppText>
                      </View>
                    </View>
                    <AppText variant="bodySmall" tone="secondary">
                      Tap this card to start a review with the highlighted dish.
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
                        <Badge label={dish.name} tone="neutral" />
                      </Pressable>
                    ))}
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="No matching stalls"
            body="Try a different stall name or clear the search to browse nearby options."
          />
        }
      />
    </Screen>
  );
}
