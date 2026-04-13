import { Linking, ScrollView, Share, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useMemo } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useProfileStore, getTasteSimilarityWithDish } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { AppText, Badge, Button, Card, EmptyState, InlineBanner, Screen } from "@/components/ui";
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

  const venue = useMemo(() => (dish ? mockRepository.getVenueById(dish.venueId) : undefined), [dish]);
  const tasteMatch = useMemo(() => (dish ? getTasteSimilarityWithDish(profile, dish) : 0), [profile, dish]);

  if (!dish || !venue) {
    return <EmptyState title="Dish not found" body="This dish is no longer available in the current mock dataset." />;
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
    <Screen scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[5], paddingBottom: spacing[8] }}
      >
        {/* Hero image */}
        <Image
          source={dish.imageUrl}
          style={{ borderRadius: radii.lg, height: 280, width: "100%" }}
          contentFit="cover"
        />

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
            {venue.name} · {venue.unitNumber} · {dish.priceRange}
          </AppText>
          <AppText tone="secondary">
            Rated {dish.rating.toFixed(1)} ★ from {dish.reviewCount} reviews
          </AppText>
        </View>

        {/* Taste dimension bars */}
        <Card>
          <AppText variant="h3">Taste profile</AppText>
          <View style={{ gap: spacing[3], marginTop: spacing[2] }}>
            {TASTE_DIMENSIONS.map((dim) => {
              const val: number = dish.tasteVector[dim.key] ?? 5;
              const pct = Math.round((val / 10) * 100);
              return (
                <View key={dim.key} style={styles.barRow}>
                  <AppText variant="bodySmall" style={{ width: 72 }}>
                    {dim.label}
                  </AppText>
                  <View style={[styles.barTrack, { backgroundColor: palette.bgSoft }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          backgroundColor: palette.orange,
                          borderRadius: 4,
                          width: `${pct}%`,
                        },
                      ]}
                    />
                  </View>
                  <AppText variant="micro" tone="muted" style={{ width: 28, textAlign: "right" }}>
                    {val}/10
                  </AppText>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginTop: spacing[3] }}>
            {dish.tasteTags.map((tag) => (
              <Badge key={tag} label={tag} tone="orange" />
            ))}
          </View>
        </Card>

        {/* Closure notice */}
        {venue.closureNotice ? <InlineBanner message={venue.closureNotice} tone="warning" /> : null}

        {/* Order / delivery */}
        <Card>
          <AppText variant="h3">Order now</AppText>
          {deliveryAvailable ? (
            <View style={{ gap: spacing[3] }}>
              {venue.deliveryLinks.map((link) => (
                <Button
                  key={link.platform}
                  label={link.platform === "grabfood" ? "Order on GrabFood" : "Order on Foodpanda"}
                  onPress={() =>
                    Linking.openURL(link.nativeUrl).catch(() => Linking.openURL(link.webUrl))
                  }
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

        {/* Action buttons */}
        <View style={{ gap: spacing[3] }}>
          <Button
            label={isSaved ? "Saved" : "Save favourite"}
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
          <Button label="Share this dish" variant="ghost" onPress={handleShare} />
        </View>

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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  barRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  barTrack: {
    borderRadius: 4,
    flex: 1,
    height: 8,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
  },
});
