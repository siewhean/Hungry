import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { ChevronLeft, Heart, Star, MapPin, Search } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Badge, Button, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { isDishDetail } from "./profileGuards";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "Favourites">;

export function FavouritesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const dishes = profile.favouriteDishIds.map((dishId) => mockRepository.getDishById(dishId)).filter(isDishDetail);
  const rootNavigation = getRootNavigation(navigation as any);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* High Fidelity Header */}
      <View style={{ 
        paddingTop: insets.top + spacing[2], 
        paddingBottom: spacing[4], 
        paddingHorizontal: spacing[4],
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <Pressable 
          onPress={() => navigation.goBack()}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: palette.bgSoft, alignItems: "center", justifyContent: "center" }}
        >
          <ChevronLeft color={palette.text} size={24} />
        </Pressable>
        <AppText style={{ fontSize: 20, fontWeight: "900", color: palette.text }}>Favourites</AppText>
        <Pressable 
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: palette.bgSoft, alignItems: "center", justifyContent: "center" }}
        >
          <Search color={palette.text} size={20} />
        </Pressable>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ 
          paddingHorizontal: spacing[4], 
          paddingBottom: insets.bottom + spacing[8],
          gap: spacing[5]
        }}
      >
        {dishes.length ? (
          dishes.map((dish) => {
            const venue = mockRepository.getVenueById(dish.venueId);
            return (
              <Pressable 
                key={dish.id} 
                onPress={() => rootNavigation.navigate("DishDetail", { dishId: dish.id })}
                style={({ pressed }) => [
                  shadows.card,
                  { 
                    backgroundColor: palette.surface, 
                    borderRadius: 24, 
                    overflow: "hidden",
                    opacity: pressed ? 0.98 : 1,
                    borderWidth: 1,
                    borderColor: palette.border,
                  }
                ]}
              >
                {/* Visuals - Large image with overlay */}
                <View style={{ width: "100%", height: 180, position: "relative" }}>
                  <Image source={{ uri: dish.imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  <Pressable 
                    onPress={() => toggleFavourite(dish)}
                    style={{ 
                      position: "absolute", top: 12, right: 12, 
                      width: 40, height: 40, borderRadius: 20, 
                      backgroundColor: "rgba(255,255,255,0.9)", 
                      alignItems: "center", justifyContent: "center",
                      ...shadows.floating
                    }}
                  >
                    <Heart size={20} color={palette.error} fill={palette.error} />
                  </Pressable>
                  <View style={{ position: "absolute", bottom: 12, left: 12 }}>
                    <Badge label="Saved" tone="orange" />
                  </View>
                </View>

                {/* Card Content */}
                <View style={{ padding: spacing[4], gap: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <AppText style={{ fontSize: 18, fontWeight: "800", color: palette.text, flex: 1 }} numberOfLines={1}>
                      {dish.name}
                    </AppText>
                    <AppText style={{ fontSize: 18, fontWeight: "800", color: palette.orange }}>
                      S${dish.price.toFixed(2)}
                    </AppText>
                  </View>
                  
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                      <Star size={14} color={palette.amber} fill={palette.amber} />
                      <AppText variant="bodySmall" style={{ fontWeight: "700" }}>{dish.rating.toFixed(1)}</AppText>
                    </View>
                    <AppText variant="bodySmall" tone="secondary"> • </AppText>
                    <AppText variant="bodySmall" tone="secondary">{venue?.name}</AppText>
                    <AppText variant="bodySmall" tone="secondary"> • </AppText>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                      <MapPin size={12} color={palette.textMuted} />
                      <AppText variant="bodySmall" tone="secondary">{Math.round(dish.distanceMeters)}m</AppText>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })
        ) : (
          <View style={{ paddingTop: spacing[12] }}>
            <EmptyState
              title="No favourites yet"
              body="Save dishes you like and they will appear here for quick access."
              ctaLabel="Start Exploring"
              onPress={() => navigation.navigate("ProfileHome")}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
