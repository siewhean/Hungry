import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { AppText, Button, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { OwnReviewMenuButton, useOwnReviewEditor } from "@/features/profile/useOwnReviewEditor";
import { useProfileStore } from "@/store/useProfileStore";
import type { Review } from "@/types/domain";
import { isDishDetail } from "./profileGuards";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "ReviewHistory">;

export function ReviewHistoryScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const reviewEntries = useProfileStore((state) => state.reviewEntries);
  const repository = getDataRepository();
  const serviceProviderMode = getServiceProvider().mode;
  const [remoteReviews, setRemoteReviews] = useState<Review[]>([]);
  const [remoteLoadFailed, setRemoteLoadFailed] = useState(false);
  const ownReviewEditor = useOwnReviewEditor({
    onUpdated: (updated) =>
      setRemoteReviews((current) =>
        current.map((review) => (review.id === updated.id ? updated : review)),
      ),
    onDeleted: (reviewId) =>
      setRemoteReviews((current) => current.filter((review) => review.id !== reviewId)),
  });
  const mockHistory = useMemo(
    () =>
      profile.reviewedDishIds.map((dishId) => repository.getDishById(dishId)).filter(isDishDetail),
    [profile.reviewedDishIds, repository],
  );
  const remoteHistory = useMemo(
    () =>
      remoteReviews.map((review) => ({
        review,
        dish: review.dishId ? repository.getDishById(review.dishId) : undefined,
      })),
    [remoteReviews, repository],
  );

  useEffect(() => {
    let active = true;
    setRemoteLoadFailed(false);

    if (serviceProviderMode === "mock") {
      setRemoteReviews([]);
      return () => {
        active = false;
      };
    }

    if (!profile.id || profile.id === "guest-user") {
      setRemoteReviews([]);
      return () => {
        active = false;
      };
    }

    void getHungryService()
      .reviews.getUserReviews(profile.id)
      .then((reviews) => {
        if (active) setRemoteReviews(reviews);
      })
      .catch(() => {
        if (!active) return;
        setRemoteReviews([]);
        setRemoteLoadFailed(true);
      });

    return () => {
      active = false;
    };
  }, [profile.id, serviceProviderMode]);

  const historyItems =
    serviceProviderMode === "supabase"
      ? remoteHistory
      : remoteHistory.length > 0
        ? remoteHistory
        : mockHistory.map((dish) => ({
            dish,
            review: undefined,
          }));
  const hasHistory = historyItems.length > 0;

  const openReviewFlow = () => {
    const rootNavigation = getRootNavigation(navigation as any);
    rootNavigation.navigate("ReviewStack", { screen: "ReviewMain" });
  };

  const openDish = (dishId: string) => {
    getRootNavigation(navigation as any).navigate("DishDetail", { dishId });
  };

  return (
    <ProfileScreenShell
      title="Review history"
      subtitle="Submitted reviews stay visible in your profile."
    >
      {hasHistory ? (
        <>
          <Button label="Write another review" variant="secondary" onPress={openReviewFlow} />
          {historyItems.map(({ review, dish }, index) => {
            const entry = dish ? reviewEntries[dish.id] : undefined;
            const tags = review?.tags ?? entry?.tags ?? [];
            const tagSummary = tags.length ? tags.join(" · ") : "";
            // Only the user's own rating: the dish average is never shown as theirs.
            const rating = review?.rating ?? entry?.rating;
            const reviewText =
              review?.text || entry?.text || "You submitted a quick review for this dish.";
            const dishId = review?.dishId ?? dish?.id;
            const dishName = dish?.name ?? "Reviewed dish";
            const ratingLine = [rating ? `Rated ${rating}/5` : "", tagSummary]
              .filter(Boolean)
              .join(" · ");
            const card = (
              <Card>
                <View style={{ gap: 12 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                    <AppText variant="h3" style={{ flex: 1 }}>
                      {dishName}
                    </AppText>
                    {review && ownReviewEditor.enabled ? (
                      <OwnReviewMenuButton onPress={() => ownReviewEditor.openActions(review)} />
                    ) : null}
                  </View>
                  <AppText tone="secondary">{reviewText}</AppText>
                  {ratingLine ? (
                    <AppText variant="bodySmall" tone="secondary">
                      {ratingLine}
                    </AppText>
                  ) : null}
                </View>
              </Card>
            );
            const key = review?.id ?? dish?.id ?? `review-history-entry-${index}`;

            return dishId ? (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`Review of ${dishName}${rating ? `, rated ${rating} out of 5` : ""}`}
                accessibilityHint="Opens the dish"
                onPress={() => openDish(dishId)}
              >
                {card}
              </Pressable>
            ) : (
              <View key={key}>{card}</View>
            );
          })}
          {ownReviewEditor.dialog}
        </>
      ) : (
        <EmptyState
          title={remoteLoadFailed ? "Review history unavailable" : "No reviews yet"}
          body={
            remoteLoadFailed
              ? "We could not load your submitted reviews. Please try again shortly."
              : "Dishes you review will appear here with your own rating and notes."
          }
          ctaLabel={remoteLoadFailed ? undefined : "Write a review"}
          onPress={remoteLoadFailed ? undefined : openReviewFlow}
        />
      )}
    </ProfileScreenShell>
  );
}
