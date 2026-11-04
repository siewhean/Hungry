import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProfileReviewCard } from "@/components/profile/ProfileReviewCard";
import { AppSymbol, AppText, Button, EmptyState } from "@/components/ui";
import { pluralLabel } from "@/features/profile/plural";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { tapHaptic } from "@/lib/haptics";
import { reportError } from "@/lib/monitoring/reportError";
import { OwnReviewMenuButton, useOwnReviewEditor } from "@/features/profile/useOwnReviewEditor";
import { useReviewDishDetails } from "@/features/profile/useReviewDishDetails";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { Review, ReviewStats } from "@/types/domain";
import { isDishDetail } from "./profileGuards";
import { ProfileReviewsSkeleton } from "./ProfileGridSkeleton";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "ReviewHistory">;

/** Reviews per server page. */
const REVIEW_HISTORY_PAGE_SIZE = 50;
// Load more re-reads this many rows before the end, so reviews deleted or posted elsewhere
// (which shift the server's offsets) cannot make it skip one; repeats are dropped by id.
const LOAD_MORE_OVERLAP = 5;

export function ReviewHistoryScreen({ navigation }: Props) {
  const { palette, spacing, radii, componentRadii, shadows } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const reviewEntries = useProfileStore((state) => state.reviewEntries);
  const showToast = useUIStore((state) => state.showToast);
  const repository = getDataRepository();
  const serviceProviderMode = getServiceProvider().mode;
  const [remoteReviews, setRemoteReviews] = useState<Review[]>([]);
  const [remoteLoadFailed, setRemoteLoadFailed] = useState(false);
  // False until the first read finishes, so "No reviews yet" never flashes while loading.
  const [remoteLoaded, setRemoteLoaded] = useState(serviceProviderMode === "mock");
  const [loadedRows, setLoadedRows] = useState(0);
  // Read by the focus refresh without making it re-run when a page is added.
  const loadedRowsRef = useRef(0);
  loadedRowsRef.current = loadedRows;
  const [hasMore, setHasMore] = useState(false);
  // Totals over every review, not just the pages loaded; undefined until read or on an older backend.
  const [stats, setStats] = useState<ReviewStats | undefined>();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Coming back from "Write another review" shows the new review without reopening the screen.
  const isFocused = useIsFocused();
  const ownReviewEditor = useOwnReviewEditor({
    onUpdated: (updated) =>
      setRemoteReviews((current) =>
        current.map((review) => (review.id === updated.id ? updated : review)),
      ),
    onDeleted: (reviewId) => {
      setRemoteReviews((current) => current.filter((review) => review.id !== reviewId));
      // The server's rows after it move up by one.
      setLoadedRows((current) => Math.max(0, current - 1));
    },
  });
  const mockHistory = useMemo(
    () =>
      profile.reviewedDishIds.map((dishId) => repository.getDishById(dishId)).filter(isDishDetail),
    [profile.reviewedDishIds, repository],
  );

  useEffect(() => {
    if (!isFocused) return;
    let active = true;
    setRemoteLoadFailed(false);

    if (serviceProviderMode === "mock" || !profile.id || profile.id === "guest-user") {
      setRemoteReviews([]);
      setRemoteLoaded(true);
      // Mock mode has the same review rows the profile shows, with the rating and the note; the
      // on-device entries below are only the fallback when it has none.
      if (serviceProviderMode === "mock" && profile.id && profile.id !== "guest-user") {
        void getHungryService()
          .reviews.getUserReviews(profile.id, { limit: REVIEW_HISTORY_PAGE_SIZE, offset: 0 })
          .then((reviews) => {
            if (active) setRemoteReviews(reviews);
          })
          .catch((error) => {
            reportError(error, { screen: "ReviewHistory", action: "load_mock_reviews" });
          });
      }
      return () => {
        active = false;
      };
    }

    void getHungryService()
      .reviews.getMyReviewStats()
      .then((result) => {
        if (active) setStats(result);
      })
      .catch((error) => {
        // The totals are a bonus: the list still shows, with the average of what is loaded.
        reportError(error, { screen: "ReviewHistory", action: "load_review_stats" });
      });

    void getHungryService()
      .reviews.getUserReviews(profile.id, { limit: REVIEW_HISTORY_PAGE_SIZE, offset: 0 })
      .then((reviews) => {
        if (!active) return;
        // Coming back refreshes page 1 and keeps the pages already loaded below it, so the
        // list does not jump back to the first 50 after opening a dish.
        const keepLaterPages = loadedRowsRef.current > REVIEW_HISTORY_PAGE_SIZE;
        const pageOneIds = new Set(reviews.map((review) => review.id));
        setRemoteReviews((current) =>
          keepLaterPages
            ? [...reviews, ...current.filter((review) => !pageOneIds.has(review.id))]
            : reviews,
        );
        if (!keepLaterPages) {
          setLoadedRows(reviews.length);
          setHasMore(reviews.length === REVIEW_HISTORY_PAGE_SIZE);
        }
        setRemoteLoaded(true);
      })
      .catch((error) => {
        reportError(error, { screen: "ReviewHistory", action: "load_reviews" });
        if (!active) return;
        // Keep what is already on screen on a failed refresh; only a first load shows the error.
        setRemoteLoadFailed(true);
        setRemoteLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [isFocused, profile.id, reloadKey, serviceProviderMode]);

  const loadMore = () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const offset = Math.max(0, loadedRows - LOAD_MORE_OVERLAP);
    const limit = REVIEW_HISTORY_PAGE_SIZE + (loadedRows - offset);
    void getHungryService()
      .reviews.getUserReviews(profile.id, { limit, offset })
      .then((reviews) => {
        setRemoteReviews((current) => {
          const seen = new Set(current.map((review) => review.id));
          return [...current, ...reviews.filter((review) => !seen.has(review.id))];
        });
        setLoadedRows(offset + reviews.length);
        setHasMore(reviews.length === limit);
      })
      .catch((error) => {
        reportError(error, { screen: "ReviewHistory", action: "load_more_reviews" });
        showToast({ message: "Couldn't load more reviews. Try again.", tone: "error" });
      })
      .finally(() => setIsLoadingMore(false));
  };

  // Mock mode has no review rows: build one per reviewed dish from the on-device entries.
  const historyReviews: Review[] = useMemo(() => {
    if (serviceProviderMode === "supabase" || remoteReviews.length > 0) return remoteReviews;
    return mockHistory.map((dish) => {
      const entry = reviewEntries[dish.id];
      return {
        id: `local-${dish.id}`,
        dishId: dish.id,
        authorId: profile.id,
        authorName: profile.displayName,
        rating: entry?.rating ?? 0,
        createdAt: entry?.createdAt ?? "",
        text: entry?.text ?? "",
        tags: entry?.tags ?? [],
        wouldRecommend: true,
        photos: [],
      };
    });
  }, [
    mockHistory,
    profile.displayName,
    profile.id,
    remoteReviews,
    reviewEntries,
    serviceProviderMode,
  ]);
  const { infoFor } = useReviewDishDetails(historyReviews);
  const hasHistory = historyReviews.length > 0;
  // Server totals first; on an older backend, the distinct-dishes counter while more pages exist.
  const reviewedCount =
    stats?.reviewCount ??
    (hasMore
      ? Math.max(profile.stats.dishesReviewed, historyReviews.length)
      : historyReviews.length);
  const ownRatings = historyReviews.map((review) => review.rating).filter((rating) => rating > 0);
  const averageRating =
    stats && stats.reviewCount > 0
      ? (stats.averageRating?.toFixed(1) ?? undefined)
      : ownRatings.length
        ? (ownRatings.reduce((total, rating) => total + rating, 0) / ownRatings.length).toFixed(1)
        : undefined;
  const maxStarCount = stats ? Math.max(1, ...stats.ratingCounts) : 1;

  const openReviewFlow = () => {
    tapHaptic();
    const rootNavigation = getRootNavigation(navigation as any);
    rootNavigation.navigate("ReviewStack", { screen: "ReviewMain" });
  };

  const openDish = (dishId: string) => {
    getRootNavigation(navigation as any).navigate("DishDetail", {
      dishId,
      source: "review_history",
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <ProfileScreenShell title="Your reviews">
        {hasHistory ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-around",
              padding: spacing[3],
              backgroundColor: palette.surfaceRaised,
              borderRadius: componentRadii.card,
            }}
          >
            <View style={{ alignItems: "center", gap: spacing[1] }}>
              <AppText variant="h1" testID="review-history-count">
                {reviewedCount}
              </AppText>
              <AppText variant="micro" tone="secondary">
                {pluralLabel(reviewedCount, "Review")}
              </AppText>
            </View>
            {averageRating ? (
              <>
                <View style={{ width: 1, height: spacing[8], backgroundColor: palette.border }} />
                <View style={{ alignItems: "center", gap: spacing[1] }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
                    <AppSymbol name="rating" size={18} color={palette.starStroke} />
                    <AppText variant="h1">{averageRating}</AppText>
                  </View>
                  <AppText variant="micro" tone="secondary">
                    Average rating
                  </AppText>
                </View>
              </>
            ) : null}
          </View>
        ) : null}
        {stats && stats.reviewCount > 0 ? (
          <View
            accessible
            accessibilityLabel={`Ratings: ${[5, 4, 3, 2, 1]
              .map((star) => `${stats.ratingCounts[star - 1]} at ${star} stars`)
              .join(", ")}`}
            style={{ gap: spacing[1] }}
            testID="review-history-histogram"
          >
            {[5, 4, 3, 2, 1].map((star) => (
              <View
                key={star}
                style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}
              >
                <View
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    gap: 2,
                    width: spacing[8],
                  }}
                >
                  <AppText variant="micro" tone="secondary">
                    {star}
                  </AppText>
                  <AppSymbol name="rating" size={10} color={palette.starStroke} />
                </View>
                <View
                  style={{
                    backgroundColor: palette.bgSoft,
                    borderRadius: radii.pill,
                    flex: 1,
                    height: spacing[2],
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      backgroundColor: palette.starFill,
                      borderRadius: radii.pill,
                      height: "100%",
                      width: `${(stats.ratingCounts[star - 1] / maxStarCount) * 100}%`,
                    }}
                  />
                </View>
                <AppText
                  variant="micro"
                  tone="secondary"
                  style={{ textAlign: "right", width: spacing[8] }}
                >
                  {stats.ratingCounts[star - 1]}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
        {!remoteLoaded && !hasHistory ? (
          <ProfileReviewsSkeleton />
        ) : hasHistory ? (
          <>
            {historyReviews.map((review, index) => (
              <ProfileReviewCard
                key={review.id}
                variant="row"
                first={index === 0}
                review={review}
                dish={infoFor(review.dishId)}
                showTags
                onOpenDish={review.dishId ? () => openDish(review.dishId as string) : undefined}
                menu={
                  serviceProviderMode === "supabase" && ownReviewEditor.enabled ? (
                    <OwnReviewMenuButton onPress={() => ownReviewEditor.openActions(review)} />
                  ) : undefined
                }
              />
            ))}
            {hasMore ? (
              <Button
                label="Load more"
                variant="ghost"
                size="sm"
                loading={isLoadingMore}
                onPress={loadMore}
              />
            ) : null}
            {ownReviewEditor.dialog}
          </>
        ) : (
          <EmptyState
            title={remoteLoadFailed ? "Review history unavailable" : "No reviews yet"}
            body={
              remoteLoadFailed
                ? "We could not load your submitted reviews. Check your connection and try again."
                : "Dishes you review will appear here with your own rating and notes."
            }
            ctaLabel={remoteLoadFailed ? "Retry" : "Write a review"}
            onPress={remoteLoadFailed ? () => setReloadKey((key) => key + 1) : openReviewFlow}
          />
        )}
      </ProfileScreenShell>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Write a review"
        onPress={openReviewFlow}
        style={({ pressed }) => [
          shadows.card,
          {
            alignItems: "center",
            backgroundColor: pressed ? palette.orangeDark : palette.orange,
            borderRadius: radii.pill,
            bottom: insets.bottom + spacing[4],
            height: 56,
            justifyContent: "center",
            position: "absolute",
            right: spacing[4],
            width: 56,
          },
        ]}
      >
        <AppSymbol name="compose" size={24} color={palette.textOnPrimary} />
      </Pressable>
    </View>
  );
}
