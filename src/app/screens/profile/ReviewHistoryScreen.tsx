import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { AppText, Button, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useResolvedProfileEntities } from "@/features/profile/useResolvedProfileEntities";
import { useHungryTheme } from "@/theme";
import type { DishDetail, Review } from "@/types/domain";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";
type Props = NativeStackScreenProps<ProfileStackParamList, "ReviewHistory">;
export function ReviewHistoryScreen({ navigation }: Props) {
  const userId = useProfileStore((state) => state.profile.id);
  const { spacing } = useHungryTheme();
  const root = getRootNavigation(navigation);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setReviews([]);
    void getHungryService()
      .reviews.getUserReviews(userId)
      .then((value) => {
        if (active) setReviews(value);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, attempt]);
  const catalog = useResolvedProfileEntities(
    reviews.flatMap((review) => (review.dishId ? [review.dishId] : [])),
    "dish",
  );
  const dishes = new Map((catalog.items as DishDetail[]).map((dish) => [dish.id, dish]));
  return (
    <ProfileScreenShell title="Review history" subtitle="Your submitted ratings and notes.">
      {loading ? (
        <AppText>Loading your reviews…</AppText>
      ) : error ? (
        <Button label="Retry loading reviews" onPress={() => setAttempt((v) => v + 1)} />
      ) : reviews.length ? (
        reviews.map((review) => {
          const dish = review.dishId ? dishes.get(review.dishId) : undefined;
          return (
            <Card key={review.id}>
              <View style={{ gap: spacing[3] }}>
                <AppText variant="h3">{dish?.name ?? "Reviewed dish"}</AppText>
                <AppText>{review.text || "Rating only"}</AppText>
                <AppText tone="muted">
                  Your rating: {review.rating}/5 · {new Date(review.createdAt).toLocaleDateString()}
                </AppText>
                {review.tags.length ? (
                  <AppText tone="muted">{review.tags.join(" · ")}</AppText>
                ) : null}
                {review.dishId ? (
                  <Button
                    label="View dish"
                    variant="secondary"
                    onPress={() => root.navigate("DishDetail", { dishId: review.dishId })}
                  />
                ) : null}
              </View>
            </Card>
          );
        })
      ) : (
        <EmptyState
          title="No reviews yet"
          body="Your reviews appear here with your own rating and notes."
          ctaLabel="Write a review"
          onPress={() => root.navigate("ReviewStack", { screen: "ReviewMain" })}
        />
      )}
      {catalog.failed ? (
        <Button variant="secondary" label="Retry loading dish names" onPress={catalog.retry} />
      ) : null}
    </ProfileScreenShell>
  );
}
