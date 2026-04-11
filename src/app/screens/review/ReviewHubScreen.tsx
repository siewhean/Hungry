import { useEffect, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { Camera, Search, Star } from "lucide-react-native";

import { AppText, Badge, Button, Card, EmptyState, Input, Screen } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { ReviewStackParamList } from "./ReviewStack";

type Props = NativeStackScreenProps<ReviewStackParamList, "ReviewHub">;

export function ReviewHubScreen({ navigation }: Props) {
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const rootNavigation = navigation.getParent()?.getParent() as any;
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showQuickReview = useUIStore((state) => state.showQuickReview);
  
  const [query, setQuery] = useState("");
  const venues = mockRepository
    .listBuildings()
    .flatMap((building) => mockRepository.listVenuesByBuilding(building.id))
    .filter((venue) =>
      `${venue.name} ${venue.unitNumber}`.toLowerCase().includes(query.trim().toLowerCase()),
    );

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
      title="Share your meal"
      subtitle="Choose a stall to share a quick text update or a full media post."
      scroll={false}
    >
      <FlatList
        data={venues}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[4], paddingBottom: spacing[8] }}
        ListHeaderComponent={
          <View style={{ paddingBottom: spacing[2] }}>
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
          const dishes = mockRepository.listDishesByVenue(item.id);
          const leadDish = dishes[0];

          return (
            <Card style={{ padding: spacing[3], gap: spacing[3] }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                <Image
                  source={{ uri: leadDish?.imageUrl }}
                  style={{ width: 64, height: 64, borderRadius: radii.md }}
                  contentFit="cover"
                />
                <View style={{ flex: 1 }}>
                  <AppText variant="h3">{item.name}</AppText>
                  <AppText variant="bodySmall" tone="secondary">
                    {item.floor} {item.unitNumber}
                  </AppText>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: spacing[2] }}>
                <Button 
                  label="Quick review" 
                  variant="secondary" 
                  fullWidth={false}
                  leftIcon={<Star size={16} color={palette.orange} fill={palette.orange} />}
                  onPress={() => {
                    showQuickReview({
                      venueId: item.id,
                      venueName: item.name,
                      dishId: leadDish?.id,
                      dishName: leadDish?.name,
                    });
                  }} 
                />
                <Button 
                  label="Post update" 
                  variant="ghost" 
                  fullWidth={false}
                  leftIcon={<Camera size={16} color={palette.textMuted} />}
                  onPress={() => {
                    rootNavigation?.navigate("Post", {
                      venueId: item.id,
                      dishId: leadDish?.id,
                    });
                  }} 
                />
              </View>
            </Card>
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
