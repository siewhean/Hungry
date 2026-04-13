import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { Heart, Star } from "lucide-react-native";

import { AppText, Button, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { isDishDetail } from "./profileGuards";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "Favourites">;

export function FavouritesScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const repository = getDataRepository();
  const dishes = profile.favouriteDishIds.map((dishId) => repository.getDishById(dishId)).filter(isDishDetail);
  const rootNavigation = getRootNavigation(navigation as any);

  return (
    <ProfileScreenShell title="Favourites" subtitle="Saved dishes that shape your taste profile.">
      {dishes.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: spacing[4] }}>
          {dishes.map((dish) => {
            const venue = repository.getVenueById(dish.venueId);
            return (
              <Pressable 
                key={dish.id} 
                onPress={() => rootNavigation.navigate("DishDetail", { dishId: dish.id })}
                style={[
                  shadows.card,
                  { 
                    width: "47%", 
                    backgroundColor: palette.surface, 
                    borderRadius: radii.lg, 
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: palette.border,
                  }
                ]}
              >
                <View style={{ height: 120, width: "100%", position: "relative" }}>
                  <Image source={{ uri: dish.imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  <Pressable 
                    onPress={() => toggleFavourite(dish)}
                    style={{ position: "absolute", top: spacing[2], right: spacing[2], width: 32, height: 32, borderRadius: radii.pill, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" }}
                  >
                    <Heart size={16} color={palette.error} fill={palette.error} />
                  </Pressable>
                </View>
                <View style={{ padding: spacing[3], gap: spacing[1] }}>
                  <AppText variant="bodyBold" numberOfLines={1}>{dish.name}</AppText>
                  <AppText variant="micro" tone="secondary" numberOfLines={1}>{venue?.name}</AppText>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing[1] }}>
                    <AppText style={{ color: palette.orange, fontWeight: "800", fontSize: 13 }}>S${dish.price.toFixed(2)}</AppText>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
                      <Star color={palette.amber} fill={palette.amber} size={10} />
                      <AppText variant="micro" style={{ fontWeight: "700" }}>{dish.rating.toFixed(1)}</AppText>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <EmptyState
          title="No favorites yet"
          body="Start exploring dishes to build your personalized list!"
          ctaLabel="Discover Dishes"
          onPress={() => rootNavigation.navigate("Discover")}
        />
      )}
    </ProfileScreenShell>
  );
}
