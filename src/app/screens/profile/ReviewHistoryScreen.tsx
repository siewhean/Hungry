import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { ReviewModerationNotice } from "@/components/review";
import { AppText, Button, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { OwnReviewMenuButton, useOwnReviewEditor } from "@/features/profile/useOwnReviewEditor";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import type { Review } from "@/types/domain";
import { isDishDetail } from "./profileGuards";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "ReviewHistory">;

/** Reviews (and signed photo links) fetched per page; "Show more" loads the next page. */
const HISTORY_PAGE_SIZE = 20;

export function ReviewHistoryScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const reviewEntries = useProfileStore((state) => state.reviewEntries);
  const repository = getDataRepository();
  const serviceProviderMode = getServiceProvider().mode;
  const [remoteReviews, setRemoteReviews] = useState<Review[]>([]);
  const [remoteLoadFailed, setRemoteLoadFailed] = useState(false);
  const [hasMoreRemote, setHasMoreRemote] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const showToast = useUIStore((state) => state.showToast);
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
    setHasMoreRemote(false);

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
      .reviews.getUserReviews(profile.id, { limit: HISTORY_PAGE_SIZE })
      .then((reviews) => {
        if (!active) return;
        setRemoteReviews(reviews);
        setHasMoreRemote(reviews.length >= HISTORY_PAGE_SIZE);
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

  const loadMore = useCallback(async () => {
    const oldest = remoteReviews[remoteReviews.length - 1];
    if (!oldest?.createdAt || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await getHungryService().reviews.getUserReviews(profile.id, {
        limit: HISTORY_PAGE_SIZE,
        before: oldest.createdAt,
        beforeId: oldest.id,
      });
      setRemoteReviews((current) => {
        const known = new Set(current.map((review) => review.id));
        return [...current, ...page.filter((review) => !known.has(review.id))];
      });
      setHasMoreRemote(page.length >= HISTORY_PAGE_SIZE);
    } catch {
      showToast({ message: "Could not load more reviews.", tone: "warning" });
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, profile.id, remoteReviews, showToast]);

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
            const ratingLine = [
              rating ? `Rated ${rating}/5` : "",
              tagSummary,
              review?.editedAt ? "Edited" : "",
            ]
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
                  {review?.moderationState ? (
                    <ReviewModerationNotice
                      state={review.moderationState}
                      reviewId={review.id}
                      dishName={dishName}
                    />
                  ) : null}
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
          {hasMoreRemote ? (
            <Button
              label={isLoadingMore ? "Loading..." : "Show more"}
              variant="secondary"
              disabled={isLoadingMore}
              onPress={() => void loadMore()}
            />
          ) : null}
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
