import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { DishReviewCard } from "@/components/dish/DishReviewCard";
import { DishReviewSummary } from "@/components/dish/DishReviewSummary";
import { AppText, Button, EmptyState, FeedErrorBoundary, Screen } from "@/components/ui";
import {
  buildReviewSummary,
  filterReviews,
  sortReviews,
  type ReviewSort,
} from "@/features/detail/dishReviewSummary";
import { useDishReviewActions } from "@/features/detail/useDishReviewActions";
import { isOwnReview } from "@/features/review/reviewEdit";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail, Review } from "@/types/domain";

type Props = NativeStackScreenProps<RootStackParamList, "DishReviews">;

/** Reviews per read; the next page is asked for with "Show more reviews". */
const PAGE_SIZE = 50;

/**
 * Every written review of one dish, a page at a time: the score and histogram on top, sort and
 * "With photos" chips under them. The dish page shows three reviews and sends everything else
 * here, so it never grows into an endless scroll.
 */
export function DishReviewsScreen({ navigation, route }: Props) {
  const { spacing } = useHungryTheme();
  const dishId = route.params?.dishId ?? "";
  const profile = useProfileStore((state) => state.profile);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const showToast = useUIStore((state) => state.showToast);
  const [dish, setDish] = useState<DishDetail>();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [withPhotos, setWithPhotos] = useState(false);
  // Bumped when the diner edits or deletes their own review: the score and total change.
  const [dishReloadKey, setDishReloadKey] = useState(0);
  const actions = useDishReviewActions({
    dishId,
    navigation,
    setReviews,
    onOwnReviewChanged: () => setDishReloadKey((key) => key + 1),
  });

  // The dish carries the score and total; a failed dish read still leaves the reviews.
  useEffect(() => {
    let active = true;
    if (!dishId) return () => undefined;
    void getHungryService()
      .discovery.getDish(dishId)
      .then((next) => {
        if (active) setDish(next);
      })
      .catch((error) => {
        reportError(error, { screen: "DishReviews", action: "load_dish", dishId });
      });
    return () => {
      active = false;
    };
  }, [dishId, dishReloadKey]);

  useEffect(() => {
    let active = true;
    if (!dishId) return () => undefined;
    setStatus("loading");
    getHungryService()
      .reviews.listRecentReviews({ dishIds: [dishId], limit: PAGE_SIZE })
      .then((entries) => {
        if (!active) return;
        setReviews(entries.map((entry) => entry.review));
        setHasMore(entries.length === PAGE_SIZE);
        setStatus("ready");
      })
      .catch((error) => {
        reportError(error, { screen: "DishReviews", action: "load_reviews", dishId });
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [dishId, reloadKey]);

  const loadMore = () => {
    const last = reviews[reviews.length - 1];
    if (!last?.createdAt || isLoadingMore) return;
    setIsLoadingMore(true);
    getHungryService()
      .reviews.listRecentReviews({
        dishIds: [dishId],
        limit: PAGE_SIZE,
        // Both cursor parts: reviews sharing the boundary timestamp are not skipped.
        before: last.createdAt,
        beforeId: last.id,
      })
      .then((entries) => {
        setReviews((current) => {
          const known = new Set(current.map((review) => review.id));
          return [
            ...current,
            ...entries.map((entry) => entry.review).filter((review) => !known.has(review.id)),
          ];
        });
        setHasMore(entries.length === PAGE_SIZE);
      })
      .catch((error) => {
        reportError(error, { screen: "DishReviews", action: "load_more_reviews", dishId });
        showToast({ message: "Couldn't load more reviews. Try again.", tone: "error" });
      })
      .finally(() => setIsLoadingMore(false));
  };

  const summary = useMemo(() => buildReviewSummary(reviews), [reviews]);
  const shown = useMemo(
    () => sortReviews(filterReviews(reviews, { withPhotos }), sort),
    [reviews, sort, withPhotos],
  );
  const viewerId = isAuthenticated ? profile.id : undefined;

  return (
    <FeedErrorBoundary title="Reviews unavailable" body="Couldn't load these reviews — try again.">
      <Screen title={dish ? `Reviews · ${dish.name}` : "Reviews"}>
        <View style={{ gap: spacing[3] }} testID="dish-reviews-screen">
          {status === "loading" ? (
            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
              <ActivityIndicator />
              <AppText variant="bodySmall" tone="secondary">
                Loading reviews...
              </AppText>
            </View>
          ) : status === "error" ? (
            <View style={{ gap: spacing[2] }}>
              <AppText variant="bodySmall" tone="secondary">
                Couldn&apos;t load reviews for this dish.
              </AppText>
              <Button
                label="Retry"
                variant="secondary"
                onPress={() => setReloadKey((key) => key + 1)}
              />
            </View>
          ) : reviews.length === 0 ? (
            <EmptyState
              title="No written reviews yet"
              body="Ratings without words are counted on the dish page."
            />
          ) : (
            <>
              <DishReviewSummary
                rating={dish?.rating ?? 0}
                ratingCount={dish?.reviewCount ?? reviews.length}
                summary={summary}
                hasMore={hasMore}
                sort={sort}
                onSort={(next) => {
                  setSort(next);
                  trackAnalyticsEvent("dish_reviews_sorted", { dish_id: dishId, sort: next });
                }}
                withPhotos={withPhotos}
                onToggleWithPhotos={() => setWithPhotos((current) => !current)}
                anyPhotos={reviews.some((review) => (review.photos?.length ?? 0) > 0)}
                showTools
              />
              {shown.length === 0 ? (
                <AppText variant="bodySmall" tone="secondary">
                  No reviews with photos yet.
                </AppText>
              ) : (
                shown.map((review) => (
                  <DishReviewCard
                    key={review.id}
                    review={review}
                    dishName={dish?.name ?? "This dish"}
                    isOwn={isOwnReview(review, viewerId)}
                    returnRoute={actions.returnRoute}
                    onOpenAuthor={actions.openAuthor}
                    onUpdated={(patch) => actions.updateReview(review.id, patch)}
                    onDeleted={() => actions.deleteReview(review.id)}
                    onRemoved={() => actions.removeReview(review.id)}
                  />
                ))
              )}
              {hasMore ? (
                <Button
                  label="Show more reviews"
                  variant="secondary"
                  loading={isLoadingMore}
                  onPress={loadMore}
                />
              ) : null}
            </>
          )}
        </View>
      </Screen>
    </FeedErrorBoundary>
  );
}
