import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { AppText, Button, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import type { DishDetail, Review } from "@/types/domain";
import { isDishDetail } from "./profileGuards";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "ReviewHistory">;

export function ReviewHistoryScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const reviewEntries = useProfileStore((state) => state.reviewEntries);
  const repository = getDataRepository();
  const service = getHungryService();
  const serviceProviderMode = getServiceProvider().mode;
  const [remoteReviews, setRemoteReviews] = useState<Review[]>([]);
  const [remoteDishesById, setRemoteDishesById] = useState<Record<string, DishDetail>>({});
  const [remoteLoadFailed, setRemoteLoadFailed] = useState(false);
  const [isRemoteLoading, setIsRemoteLoading] = useState(serviceProviderMode === "supabase");
  const mockHistory = useMemo(
    () =>
      profile.reviewedDishIds.map((dishId) => repository.getDishById(dishId)).filter(isDishDetail),
    [profile.reviewedDishIds, repository],
  );
  const remoteHistory = useMemo(
    () =>
      remoteReviews.map((review) => ({
        review,
        dish: review.dishId ? remoteDishesById[review.dishId] : undefined,
      })),
    [remoteDishesById, remoteReviews],
  );

  useEffect(() => {
    let active = true;
    setRemoteLoadFailed(false);
    setIsRemoteLoading(serviceProviderMode === "supabase");

    if (serviceProviderMode === "mock") {
      setRemoteReviews([]);
      setRemoteDishesById({});
      setIsRemoteLoading(false);
      return () => {
        active = false;
      };
    }

    if (!profile.id || profile.id === "guest-user") {
      setRemoteReviews([]);
      setRemoteDishesById({});
      setIsRemoteLoading(false);
      return () => {
        active = false;
      };
    }

    void service.reviews
      .getUserReviews(profile.id)
      .then(async (reviews) => {
        const dishIds = Array.from(
          new Set(reviews.flatMap((review) => (review.dishId ? [review.dishId] : []))),
        );
        const dishes = await service.discovery.getDishes(dishIds);
        if (!active) return;
        setRemoteReviews(reviews);
        setRemoteDishesById(
          Object.fromEntries(
            dishes
              .filter((dish): dish is DishDetail => Boolean(dish))
              .map((dish) => [dish.id, dish]),
          ),
        );
      })
      .catch(() => {
        if (!active) return;
        setRemoteReviews([]);
        setRemoteDishesById({});
        setRemoteLoadFailed(true);
      })
      .finally(() => {
        if (active) setIsRemoteLoading(false);
      });

    return () => {
      active = false;
    };
  }, [profile.id, service, serviceProviderMode]);

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

  return (
    <ProfileScreenShell
      title="Review history"
      subtitle="Submitted reviews stay visible in your profile."
    >
      {isRemoteLoading ? (
        <View accessibilityLabel="Loading review history" accessibilityRole="progressbar">
          <ActivityIndicator />
        </View>
      ) : hasHistory ? (
        historyItems.map(({ review, dish }) => {
          const entry = dish ? reviewEntries[dish.id] : undefined;
          const tags = review?.tags ?? entry?.tags ?? [];
          const tagSummary = tags.length ? tags.join(" · ") : "";
          const rating = review?.rating ?? entry?.rating ?? dish?.rating ?? 0;
          const reviewText =
            review?.text || entry?.text || "You submitted a quick review for this dish.";

          return (
            <Card key={review?.id ?? dish?.id ?? "review-history-entry"}>
              <View style={{ gap: 12 }}>
                <AppText variant="h3">{dish?.name ?? "Reviewed dish"}</AppText>
                <AppText tone="secondary">{reviewText}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Rated {rating}/5
                  {tagSummary ? ` · ${tagSummary}` : ""}
                </AppText>
                <Button label="Write another review" variant="secondary" onPress={openReviewFlow} />
              </View>
            </Card>
          );
        })
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
