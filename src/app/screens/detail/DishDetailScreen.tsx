import { Animated, ScrollView, Share, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useMemo, useRef } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { mockRepository } from "@/lib/services/mock/repositories";
import { buildDishGallery } from "@/features/detail/detailTransforms";
import { useProfileStore, getTasteSimilarityWithDish } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { AppText, Badge, Button, Card, EmptyState, InlineBanner, FAB } from "@/components/ui";
import { DeliveryPlatformButton } from "@/components/dish/DeliveryPlatformButton";
import { TASTE_DIMENSIONS } from "@/constants/taste";

type Props = NativeStackScreenProps<RootStackParamList, "DishDetail">;

export function DishDetailScreen({ navigation, route }: Props) {
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const dish = mockRepository.getDishById(route.params?.dishId ?? "");
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const showToast = useUIStore((state) => state.showToast);
  const { palette, radii, spacing } = useHungryTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const heroScrollX = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  const venue = useMemo(() => (dish ? mockRepository.getVenueById(dish.venueId) : undefined), [dish]);
  const tasteMatch = useMemo(() => (dish ? getTasteSimilarityWithDish(profile, dish) : 0), [profile, dish]);
  const gallery = useMemo(() => (dish ? buildDishGallery(dish) : []), [dish]);

  const maxTasteScore = useMemo(() => {
    if (!dish) {
      return 0;
    }
    return Math.max(...TASTE_DIMENSIONS.map((d) => dish.tasteVector[d.key] ?? 0));
  }, [dish]);

  const heroWidth = Math.round(viewportWidth);
  const indicatorDotSize = 7;
  const indicatorStep = 14;
  const indicatorTrackWidth = Math.max(indicatorDotSize, indicatorDotSize + Math.max(0, gallery.length - 1) * indicatorStep);

  if (!dish || !venue) {
    return (
      <SafeAreaView style={{ backgroundColor: palette.bg, flex: 1 }} edges={["top", "left", "right"]}>
        <EmptyState title="Dish not found" body="This dish is no longer available in the current mock dataset." />
      </SafeAreaView>
    );
  }

  const deliveryAvailable = venue.deliveryLinks.length > 0;
  const isSaved = profile.favouriteDishIds.includes(dish.id);

  const handleShare = () => {
    Share.share({
      title: `${dish.name} at ${venue.name}`,
      message: `Check out ${dish.name} at ${venue.name} (${venue.unitNumber}) on Hungry.`,
    });
  };

  return (
    <SafeAreaView style={{ backgroundColor: palette.bg, flex: 1 }} edges={["top", "left", "right"]}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        contentContainerStyle={{ gap: spacing[5], paddingBottom: spacing[16] + 120 }}
      >
        {/* Hero image carousel */}
        <Animated.View
          style={{
            width: heroWidth,
            transform: [
              {
                scale: scrollY.interpolate({
                  inputRange: [-150, 0],
                  outputRange: [1.6, 1],
                  extrapolate: "clamp",
                }),
              },
              {
                translateY: scrollY.interpolate({
                  inputRange: [-150, 0, 150],
                  outputRange: [-75, 0, 50],
                  extrapolate: "clamp",
                }),
              },
            ],
          }}
        >
          <Animated.ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            bounces={false}
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: heroScrollX } } }],
              { useNativeDriver: true },
            )}
            snapToInterval={heroWidth}
            snapToAlignment="start"
            style={{ width: heroWidth }}
          >
            {gallery.map((uri) => (
              <Image
                key={uri}
                source={uri}
                style={{ height: 300, width: heroWidth }}
                contentFit="cover"
              />
            ))}
          </Animated.ScrollView>
          <View
            pointerEvents="none"
            style={{
              alignItems: "center",
              bottom: spacing[3],
              left: 0,
              position: "absolute",
              right: 0,
            }}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.82)",
                borderRadius: radii.pill,
                justifyContent: "center",
                paddingHorizontal: spacing[2],
                paddingVertical: 7,
              }}
            >
              <View
                style={{
                  height: indicatorDotSize,
                  position: "relative",
                  width: indicatorTrackWidth,
                }}
              >
                {gallery.map((uri, index) => (
                  <View
                    key={`${uri}-${index}`}
                    style={{
                      backgroundColor: palette.border,
                      borderRadius: radii.pill,
                      height: indicatorDotSize,
                      left: index * indicatorStep,
                      position: "absolute",
                      top: 0,
                      width: indicatorDotSize,
                    }}
                  />
                ))}
                <Animated.View
                  style={{
                    backgroundColor: palette.orange,
                    borderRadius: radii.pill,
                    height: indicatorDotSize,
                    left: 0,
                    position: "absolute",
                    top: 0,
                    transform: [
                      {
                        translateX: heroScrollX.interpolate({
                          inputRange: [0, Math.max(1, gallery.length - 1) * heroWidth],
                          outputRange: [0, Math.max(0, gallery.length - 1) * indicatorStep],
                          extrapolate: "clamp",
                        }),
                      },
                    ],
                    width: indicatorDotSize,
                  }}
                />
              </View>
            </View>
          </View>
        </Animated.View>

        <View style={{ gap: spacing[5], paddingHorizontal: spacing[5] }}>
          {/* Badges & title */}
          <View style={{ gap: spacing[3] }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {dish.mustOrder ? <Badge label="Must order" tone="amber" /> : null}
            <Badge label={`${tasteMatch}% taste match`} tone="orange" />
            {dish.availabilityFlags.map((flag) => (
              <Badge key={flag} label={flag} tone="neutral" />
            ))}
          </View>
          <AppText variant="h1">{dish.name}</AppText>
          <AppText tone="secondary">
            {venue.name} · {venue.unitNumber}
          </AppText>
          <AppText variant="price">{dish.priceRange}</AppText>
          <AppText tone="secondary">
            Rated {dish.rating.toFixed(1)} ★ from {dish.reviewCount} reviews
          </AppText>
          </View>

          {/* Taste graph + tags */}
          <View>
            <AppText variant="h3">Taste profile</AppText>
            <View style={{ gap: spacing[3], marginTop: spacing[3] }}>
              {TASTE_DIMENSIONS.map((dimension) => {
                const score = dish.tasteVector[dimension.key] ?? 0;
                const isDominant = score === maxTasteScore && score > 0;
                const progressWidth = `${Math.max(0, Math.min(100, Math.round((score / 10) * 100)))}%` as const;

                return (
                  <View key={dimension.key} style={{ gap: spacing[1] }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <AppText
                        variant="bodySmall"
                        style={{ fontFamily: isDominant ? "Nunito_700Bold" : "Nunito_400Regular" }}
                      >
                        {dimension.label}
                      </AppText>
                      <AppText variant="micro" tone="secondary">
                        {score.toFixed(1)}
                      </AppText>
                    </View>
                    <View
                      style={{
                        backgroundColor: palette.border,
                        borderRadius: radii.pill,
                        height: 8,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: isDominant ? palette.orange : palette.orangeLight,
                          borderRadius: radii.pill,
                          height: "100%",
                          width: progressWidth,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginTop: spacing[3] }}>
              {dish.tasteTags.map((tag) => (
                <Badge key={tag} label={tag} tone="orange" />
              ))}
            </View>
          </View>

          {/* Closure notice */}
          {venue.closureNotice ? <InlineBanner message={venue.closureNotice} tone="warning" /> : null}

          {/* Order / delivery */}
          <Card>
            <AppText variant="h3">Order now</AppText>
            {deliveryAvailable ? (
              <View style={{ gap: spacing[3] }}>
                {venue.deliveryLinks.map((link) => (
                  <DeliveryPlatformButton
                    key={link.platform}
                    link={link}
                  />
                ))}
              </View>
            ) : (
              <EmptyState
                title="Dine-in only"
                body="This stall has no verified delivery links yet."
              />
            )}
          </Card>

          {/* Reviews */}
          <Card>
            <AppText variant="h3">Recent reviews</AppText>
            {dish.reviews.length ? (
              dish.reviews.map((review) => (
                <View key={review.id} style={{ gap: spacing[2] }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <AppText variant="bodyLarge">{review.authorName}</AppText>
                    <AppText tone="muted" variant="bodySmall">
                      {review.rating}/5 ★
                    </AppText>
                  </View>
                  <AppText tone="secondary" variant="bodySmall">
                    {review.createdAt}
                  </AppText>
                  <AppText>{review.text}</AppText>
                </View>
              ))
            ) : (
              <AppText tone="secondary">No reviews yet. Be the first!</AppText>
            )}
          </Card>
        </View>
      </Animated.ScrollView>
      <FAB>
        <Button
          fullWidth={false}
          label={isSaved ? "Saved" : "Save favourite"}
          variant={isSaved ? "secondary" : "primary"}
          onPress={() => {
            if (!isAuthenticated) {
              setReturnRoute({ name: "DishDetail", params: { dishId: dish.id } });
              navigation.navigate("AuthStack", { screen: "Login" });
              return;
            }
            toggleFavourite(dish);
            showToast({
              message: isSaved ? "Removed from favourites." : "Saved to favourites!",
              tone: "success",
            });
          }}
        />
        <Button
          fullWidth={false}
          label="Write a review"
          variant="secondary"
          onPress={() => {
            if (!isAuthenticated) {
              setReturnRoute({
                name: "ReviewStack",
                params: {
                  screen: "ReviewRating",
                  params: { venueId: venue.id, dishId: dish.id },
                },
              });
              navigation.navigate("AuthStack", { screen: "Login" });
              return;
            }
            navigation.navigate("ReviewStack", {
              screen: "ReviewRating",
              params: { venueId: venue.id, dishId: dish.id },
            });
          }}
        />
      </FAB>
    </SafeAreaView>
  );
}
