import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Heart, Star } from "lucide-react-native";

import { AccessibleImage, AppText, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { prefetchDishDetail, preloadRoute } from "@/features/navigation/prefetch";
import { isUsableDiscoverImageUrl } from "@/features/discover/bites";
import { formatDiscoverPrice, getDishFallbackImageSource } from "@/features/discover/presentation";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";
import type { DishDetail } from "@/types/domain";

type Props = NativeStackScreenProps<ProfileStackParamList, "Favourites">;

function FavouriteDishImage({ dish, sourceBacked }: { dish: DishDetail; sourceBacked: boolean }) {
  const { palette, spacing } = useHungryTheme();
  const [remoteImageFailed, setRemoteImageFailed] = useState(false);
  const showRemoteImage =
    sourceBacked && isUsableDiscoverImageUrl(dish.imageUrl) && !remoteImageFailed;

  useEffect(() => {
    setRemoteImageFailed(false);
  }, [dish.id, dish.imageUrl]);

  return (
    <>
      <AccessibleImage
        source={showRemoteImage ? { uri: dish.imageUrl } : getDishFallbackImageSource(dish)}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        cachePolicy="memory-disk"
        onError={showRemoteImage ? () => setRemoteImageFailed(true) : undefined}
        decorative
      />
      {!showRemoteImage ? (
        <View
          pointerEvents="none"
          style={{
            backgroundColor: palette.imageLabelSurface,
            bottom: spacing[2],
            left: spacing[2],
            paddingHorizontal: spacing[1],
            paddingVertical: spacing[0.5],
            position: "absolute",
          }}
        >
          <AppText
            variant="micro"
            style={{ color: palette.textOnDark, fontSize: 8, fontWeight: "900" }}
          >
            REPRESENTATIVE
          </AppText>
        </View>
      ) : null}
    </>
  );
}

export function FavouritesScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const { componentRadii, palette, spacing, shadows } = useHungryTheme();
  const repository = getDataRepository();
  const service = getHungryService();
  const sourceBackedImages = getServiceProvider().mode === "supabase";
  const [dishes, setDishes] = useState<DishDetail[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isLoading, setIsLoading] = useState(profile.favouriteDishIds.length > 0);
  const rootNavigation = getRootNavigation(navigation as any);

  useEffect(() => {
    let active = true;

    if (!profile.favouriteDishIds.length) {
      setDishes([]);
      setLoadError(null);
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    setLoadError(null);
    void service.discovery
      .getDishes(profile.favouriteDishIds)
      .then((resolvedDishes) => {
        if (!active) return;
        setDishes(resolvedDishes);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setDishes([]);
        setLoadError(
          error instanceof Error ? error.message : "Saved dishes are temporarily unavailable.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadAttempt, profile.favouriteDishIds, service]);

  return (
    <ProfileScreenShell title="Favourites" subtitle="Saved dishes that shape your taste profile.">
      {isLoading ? (
        <View accessibilityLabel="Loading saved dishes" accessibilityRole="progressbar">
          <ActivityIndicator color={palette.orange} />
        </View>
      ) : loadError ? (
        <EmptyState
          title="Saved dishes unavailable"
          body={loadError}
          ctaLabel="Try again"
          onPress={() => setLoadAttempt((attempt) => attempt + 1)}
        />
      ) : dishes.length ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: spacing[4],
          }}
        >
          {dishes.map((dish) => (
            <Pressable
              key={dish.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${dish.name}${dish.venueName ? ` at ${dish.venueName}` : ""}`}
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
                <FavouriteDishImage dish={dish} sourceBacked={sourceBackedImages} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${dish.name} from favourites`}
                  onPress={() => toggleFavourite(dish)}
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
                  {dish.venueName}
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
                    {formatDiscoverPrice(dish)}
                  </AppText>
                  {dish.reviewCount > 0 && dish.rating > 0 ? (
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
                  ) : null}
                </View>
              </View>
            </Pressable>
          ))}
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
