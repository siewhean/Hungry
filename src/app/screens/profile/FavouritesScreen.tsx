import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";

import { AppText, Button, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { isDishDetail } from "./profileGuards";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "Favourites">;

export function FavouritesScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const { palette, radii, spacing } = useHungryTheme();
  const dishes = profile.favouriteDishIds.map((dishId) => mockRepository.getDishById(dishId)).filter(isDishDetail);
  const rootNavigation = getRootNavigation(navigation as any);

  return (
    <ProfileScreenShell title="Favourites" subtitle="Saved dishes that shape your taste profile.">
      {dishes.length ? (
        dishes.map((dish) => {
          const venue = mockRepository.getVenueById(dish.venueId);
          return (
            <Card key={dish.id} style={{ padding: 0, overflow: "hidden" }}>
              <Pressable onPress={() => rootNavigation.navigate("DishDetail", { dishId: dish.id })}>
                <Image source={{ uri: dish.imageUrl }} style={{ width: "100%", height: 168 }} contentFit="cover" />
                <View style={{ gap: spacing[2], padding: spacing[4] }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[3] }}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="h3">{dish.name}</AppText>
                      <AppText tone="secondary">{venue?.name}</AppText>
                    </View>
                    <AppText variant="price">S${dish.price.toFixed(2)}</AppText>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[3] }}>
                    <AppText variant="bodySmall" tone="secondary">{dish.rating.toFixed(1)} ★</AppText>
                    <AppText variant="bodySmall" tone="secondary">{dish.distanceMeters}m away</AppText>
                  </View>
                </View>
              </Pressable>
              <View style={{ borderTopColor: palette.border, borderTopWidth: 1, padding: spacing[3] }}>
                <Button label="Remove favourite" variant="secondary" onPress={() => toggleFavourite(dish)} />
              </View>
            </Card>
          );
        })
      ) : (
        <EmptyState
          title="No favourites yet"
          body="Save dishes you like and they will appear here for quick re-ordering."
          ctaLabel="Discover dishes"
          onPress={() => navigation.navigate("ProfileHome")}
        />
      )}
    </ProfileScreenShell>
  );
}
