import { ScrollView, View } from "react-native";
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

type Props = NativeStackScreenProps<RootStackParamList, "DishDetail">;

export function DishDetailScreen({ navigation, route }: Props) {
  const dish = mockRepository.getDishById(route.params.dishId);
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const showSoftGate = useUIStore((state) => state.showSoftGate);
  const { palette, radii, spacing } = useHungryTheme();

  const venue = useMemo(() => (dish ? mockRepository.getVenueById(dish.venueId) : undefined), [dish]);
  const tasteMatch = useMemo(() => (dish ? getTasteSimilarityWithDish(profile, dish) : 0), [profile, dish]);

  if (!dish || !venue) {
    return <EmptyState title="Dish not found" body="This dish is no longer available in the current mock dataset." />;
  }

  const deliveryAvailable = venue.deliveryLinks.length > 0;

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ gap: spacing[5], paddingBottom: spacing[8] }}>
        <Image
          source={dish.imageUrl}
          style={{ borderRadius: radii.lg, height: 280, width: "100%" }}
          contentFit="cover"
        />

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
            Rated {dish.rating.toFixed(1)} from {dish.reviewCount} reviews
          </AppText>
        </View>

        <Card>
          <AppText variant="h3">Taste profile</AppText>
          <AppText tone="secondary">
            Sweet {dish.tasteVector.sweet}, spicy {dish.tasteVector.spicy}, sour {dish.tasteVector.sour}, salty{" "}
            {dish.tasteVector.salty}, rich {dish.tasteVector.rich}, aromatic {dish.tasteVector.aromatic}
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {dish.tasteTags.map((tag) => (
              <Badge key={tag} label={tag} tone="orange" />
            ))}
          </View>
        </Card>

        {venue.closureNotice ? <InlineBanner message={venue.closureNotice} tone="warning" /> : null}

        <Card>
          <AppText variant="h3">Order now</AppText>
          {deliveryAvailable ? (
            <View style={{ gap: spacing[3] }}>
              {venue.deliveryLinks.map((link) => (
                <Button
                  key={link.platform}
                  label={link.platform === "grabfood" ? "Order on GrabFood" : "Order on Foodpanda"}
                  onPress={() =>
                    navigation.navigate("NotFound", {
                      title: "Delivery handoff mocked",
                      body: `This mock build would open ${link.platform} via native app or web fallback.`,
                    })
                  }
                />
              ))}
            </View>
          ) : (
            <EmptyState
              title="Dine-in only"
              body="This stall has no verified delivery links yet. The final app will hide the CTA and keep this state concise."
            />
          )}
        </Card>

        <View style={{ gap: spacing[3] }}>
          <Button
            label={profile.favouriteDishIds.includes(dish.id) ? "Remove favourite" : "Save favourite"}
            onPress={() => {
              if (!isAuthenticated) {
                showSoftGate();
                return;
              }
              toggleFavourite(dish);
            }}
          />
          <Button
            label="Write a review"
            variant="secondary"
            onPress={() => {
              if (!isAuthenticated) {
                showSoftGate();
                return;
              }
              navigation.navigate("ReviewStack", {
                screen: "ReviewRating",
                params: { dishId: dish.id },
              });
            }}
          />
        </View>

        <Card>
          <AppText variant="h3">Recent reviews</AppText>
          {dish.reviews.length ? (
            dish.reviews.map((review) => (
              <View key={review.id} style={{ gap: spacing[2] }}>
                <AppText variant="bodyLarge">{review.authorName}</AppText>
                <AppText tone="secondary">
                  {review.rating}/5 · {review.createdAt}
                </AppText>
                <AppText>{review.text}</AppText>
              </View>
            ))
          ) : (
            <AppText tone="secondary">No reviews yet. The first review submitted in the mock flow lands here.</AppText>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

