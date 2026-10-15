import { useEffect, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Heart, Star } from "lucide-react-native";

import { AccessibleImage, AppText, Button, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { prefetchDishDetail, preloadRoute } from "@/features/navigation/prefetch";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import type { CatalogRawDishDetail } from "@/lib/services/catalog";
import {
  getCatalogRawService,
  getDataRepository,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { isDishDetail } from "./profileGuards";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "Favourites">;

/**
 * Release 0.1 favourites: saved ids are canonical dish ids, resolved through the
 * release-versioned catalog and opened in the catalog detail screen.
 */
function CatalogFavouritesScreen({ navigation }: Props) {
  const favouriteDishIds = useProfileStore((state) => state.profile.favouriteDishIds);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const showToast = useUIStore((state) => state.showToast);
  const { componentRadii, palette, spacing } = useHungryTheme();
  const rootNavigation = getRootNavigation(navigation as any);
  const [dishes, setDishes] = useState<CatalogRawDishDetail[]>([]);
  const [unavailableCount, setUnavailableCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDishId, setPendingDishId] = useState<string | null>(null);
  const favouriteKey = favouriteDishIds.join(",");

  useEffect(() => {
    let cancelled = false;
    const service = getCatalogRawService();
    const ids = favouriteKey ? favouriteKey.split(",") : [];
    if (!service || ids.length === 0) {
      setDishes([]);
      setUnavailableCount(0);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    void Promise.allSettled(ids.map((id) => service.getDish(id))).then((results) => {
      if (cancelled) return;
      const loaded = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      setDishes(loaded);
      setUnavailableCount(results.length - loaded.length);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [favouriteKey]);

  const removeFavourite = async (dish: CatalogRawDishDetail) => {
    setPendingDishId(dish.id);
    try {
      const result = await toggleFavourite({ id: dish.id, venueId: dish.venueId });
      showToast(
        result.status === "failed"
          ? { message: result.message, tone: "error" }
          : { message: "Removed from favourites.", tone: "success" },
      );
    } finally {
      setPendingDishId(null);
    }
  };

  return (
    <ProfileScreenShell title="Favourites" subtitle="Dishes you saved to come back to.">
      {isLoading ? (
        <ActivityIndicator accessibilityLabel="Loading favourites" color={palette.orange} />
      ) : dishes.length ? (
        <View style={{ gap: spacing[3] }}>
          {dishes.map((dish) => (
            <View
              key={dish.id}
              style={{
                alignItems: "center",
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: componentRadii.card,
                borderWidth: 1,
                flexDirection: "row",
                gap: spacing[3],
                padding: spacing[3],
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${dish.name} at ${dish.venueName}`}
                onPress={() =>
                  rootNavigation.navigate("CatalogRawDetail", { kind: "dish", id: dish.id })
                }
                style={{ flex: 1, gap: spacing[1] }}
              >
                <AppText variant="bodyBold" numberOfLines={1}>
                  {dish.name}
                </AppText>
                <AppText variant="micro" tone="secondary" numberOfLines={1}>
                  {dish.venueName}
                </AppText>
                {dish.price !== undefined ? (
                  <AppText style={{ color: palette.orange, fontWeight: "800", fontSize: 13 }}>
                    S${dish.price.toFixed(2)}
                  </AppText>
                ) : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${dish.name} from favourites`}
                accessibilityState={{ busy: pendingDishId === dish.id }}
                disabled={pendingDishId === dish.id}
                onPress={() => void removeFavourite(dish)}
                style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}
              >
                {pendingDishId === dish.id ? (
                  <ActivityIndicator color={palette.error} />
                ) : (
                  <Heart size={18} color={palette.error} fill={palette.error} />
                )}
              </Pressable>
            </View>
          ))}
          {unavailableCount > 0 ? (
            <AppText tone="muted" variant="micro">
              {unavailableCount === 1
                ? "1 saved dish is not in the current catalog."
                : `${unavailableCount} saved dishes are not in the current catalog.`}
            </AppText>
          ) : null}
        </View>
      ) : (
        <EmptyState
          title={unavailableCount > 0 ? "Saved dishes unavailable" : "No favourites yet"}
          body={
            unavailableCount > 0
              ? "Your saved dishes are not in the current catalog. Check your connection and try again."
              : "Tap Save to favourites on any dish to keep it here."
          }
          ctaLabel="Discover Dishes"
          onPress={() => rootNavigation.navigate("MainTabs", { screen: "Discover" })}
        />
      )}
    </ProfileScreenShell>
  );
}

export function FavouritesScreen(props: Props) {
  const useCatalog = FEATURE_FLAGS.catalogReadV2 && getServiceProvider().mode === "supabase";
  return useCatalog ? (
    <CatalogFavouritesScreen {...props} />
  ) : (
    <LegacyFavouritesScreen {...props} />
  );
}

function LegacyFavouritesScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const showToast = useUIStore((state) => state.showToast);
  const { componentRadii, palette, spacing, shadows } = useHungryTheme();
  const repository = getDataRepository();
  const dishes = profile.favouriteDishIds
    .map((dishId) => repository.getDishById(dishId))
    .filter(isDishDetail);
  const rootNavigation = getRootNavigation(navigation as any);

  return (
    <ProfileScreenShell title="Favourites" subtitle="Saved dishes that shape your taste profile.">
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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${dish.name} from favourites`}
                    onPress={() =>
                      void toggleFavourite(dish).then((result) => {
                        if (result.status === "failed") {
                          showToast({ message: result.message, tone: "error" });
                        }
                      })
                    }
                    style={{
                      position: "absolute",
                      top: spacing[2],
                      right: spacing[2],
                      width: 32,
                      height: 32,
                      borderRadius: componentRadii.iconButton,
                      backgroundColor: palette.surfaceTranslucent,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Heart size={16} color={palette.error} fill={palette.error} />
                  </Pressable>
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
      ) : (
        <EmptyState
          title="No favorites yet"
          body="Start exploring dishes to build your personalized list!"
          ctaLabel="Discover Dishes"
          onPress={() => rootNavigation.navigate("MainTabs", { screen: "Discover" })}
        />
      )}
    </ProfileScreenShell>
  );
}
