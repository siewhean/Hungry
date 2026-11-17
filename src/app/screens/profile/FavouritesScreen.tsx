import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Heart, Star } from "lucide-react-native";

import { AccessibleImage, AppText, Button, Chip, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { prefetchDishDetail, preloadRoute } from "@/features/navigation/prefetch";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { useResolvedProfileEntities } from "@/features/profile/useResolvedProfileEntities";
import type { DishDetail } from "@/types/domain";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "Favourites">;

export function FavouritesScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const { componentRadii, palette, spacing, shadows } = useHungryTheme();
  const repository = getDataRepository();
  const [tab, setTab] = useState<"want" | "tried">("want");
  const dishIds = tab === "want" ? profile.favouriteDishIds : profile.reviewedDishIds;
  const resolved = useResolvedProfileEntities(dishIds, "dish");
  const dishes = resolved.items as DishDetail[];
  const rootNavigation = getRootNavigation(navigation as any);

  return (
    <ProfileScreenShell title="Saved dishes" subtitle="Saved dishes and your reviewed dishes.">
      <View style={{ flexDirection: "row", gap: spacing[2], marginBottom: spacing[4] }}>
        <Chip
          label={`Want to try (${profile.favouriteDishIds.length})`}
          selected={tab === "want"}
          onPress={() => setTab("want")}
        />
        <Chip
          label={`Reviewed (${profile.reviewedDishIds.length})`}
          selected={tab === "tried"}
          onPress={() => setTab("tried")}
        />
      </View>
      {resolved.loading ? <AppText>Loading saved dishes…</AppText> : null}
      {resolved.failed ? (
        <Button
          label={`Retry ${resolved.failed} dishes that failed to load`}
          onPress={resolved.retry}
        />
      ) : null}
      {resolved.missing ? (
        <AppText tone="muted">{resolved.missing} saved dishes are no longer available.</AppText>
      ) : null}
      {dishes.length ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: spacing[4],
          }}
        >
          {dishes.map((dish) => {
            const venue = repository.getVenueById(dish.venueId);
            return (
              <Pressable
                key={dish.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${dish.name}${venue?.name ? ` at ${venue.name}` : ""}`}
                onPressIn={() => {
                  prefetchDishDetail(dish.id, repository);
                  preloadRoute(rootNavigation, "DishDetail", { dishId: dish.id });
                }}
                onPress={() => rootNavigation.navigate("DishDetail", { dishId: dish.id })}
                style={[
                  shadows.card,
                  {
                    width: "47%",
                    backgroundColor: palette.surface,
                    borderRadius: componentRadii.card,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: palette.border,
                  },
                ]}
              >
                <View style={{ height: 120, width: "100%", position: "relative" }}>
                  <AccessibleImage
                    source={{ uri: dish.imageUrl }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    decorative
                  />
                  {tab === "want" ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${dish.name} from favourites`}
                      onPress={() => toggleFavourite(dish)}
                      style={{
                        position: "absolute",
                        top: spacing[2],
                        right: spacing[2],
                        width: spacing[12],
                        height: spacing[12],
                        borderRadius: componentRadii.iconButton,
                        backgroundColor: palette.surfaceTranslucent,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Heart size={16} color={palette.error} fill={palette.error} />
                    </Pressable>
                  ) : null}
                </View>
                <View style={{ padding: spacing[3], gap: spacing[1] }}>
                  <AppText variant="bodyBold" numberOfLines={1}>
                    {dish.name}
                  </AppText>
                  <AppText variant="micro" tone="secondary" numberOfLines={1}>
                    {venue?.name}
                  </AppText>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: spacing[1],
                    }}
                  >
                    <AppText
                      style={{
                        color: palette.orange,
                        fontWeight: "800",
                        fontSize: 13,
                      }}
                    >
                      S${dish.price.toFixed(2)}
                    </AppText>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing[1],
                      }}
                    >
                      <Star color={palette.amber} fill={palette.amber} size={10} />
                      <AppText variant="micro" style={{ fontWeight: "700" }}>
                        {dish.rating.toFixed(1)}
                      </AppText>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : !resolved.loading && !resolved.failed && !resolved.missing ? (
        <EmptyState
          title={tab === "want" ? "Nothing saved yet" : "No reviewed dishes yet"}
          body={
            tab === "want"
              ? "Save dishes you want to try and they'll show up here."
              : "Review a dish to keep your rating and notes here."
          }
          ctaLabel="Discover Dishes"
          onPress={() => rootNavigation.navigate("MainTabs", { screen: "Discover" })}
        />
      ) : null}
    </ProfileScreenShell>
  );
}
