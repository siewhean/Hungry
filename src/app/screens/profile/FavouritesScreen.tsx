import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";

import { AppText, Button, Card, EmptyState } from "@/components/ui";
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
  const dishes = profile.favouriteDishIds.map((dishId) => mockRepository.getDishById(dishId)).filter(isDishDetail);
  const { radii, spacing } = useHungryTheme();

  return (
    <ProfileScreenShell title="Favourites" subtitle="Saved dishes that shape your taste profile.">
      {dishes.length ? (
        dishes.map((dish) => {
          const venue = mockRepository.getVenueById(dish.venueId);
          return (
            <Card key={dish.id}>
              <Pressable
                onPress={() => navigation.getParent<any>()?.navigate("DishDetail", { dishId: dish.id })}
                style={{ gap: 12 }}
              >
                <Image
                  source={{ uri: dish.imageUrl }}
                  style={{ borderRadius: radii.md, height: 140, width: "100%" }}
                  contentFit="cover"
                />
                <View style={{ gap: spacing[1] }}>
                  <AppText variant="h3">{dish.name}</AppText>
                  <AppText tone="secondary">{venue?.name ?? dish.venueName}</AppText>
                  <View style={{ flexDirection: "row", gap: spacing[2] }}>
                    <AppText tone="secondary">{dish.rating.toFixed(1)} ★</AppText>
                    <AppText tone="secondary">·</AppText>
                    <AppText tone="secondary">{dish.priceRange}</AppText>
                  </View>
                </View>
                <Button label="Remove favourite" variant="secondary" onPress={() => toggleFavourite(dish)} />
              </Pressable>
            </Card>
          );
        })
      ) : (
        <EmptyState
          title="No favourites yet"
          body="Save dishes you love and they'll appear here. Your taste profile updates as you save more."
          ctaLabel="Explore dishes"
          onPress={() => navigation.getParent<any>()?.navigate("Discover")}
        />
      )}
    </ProfileScreenShell>
  );
}
