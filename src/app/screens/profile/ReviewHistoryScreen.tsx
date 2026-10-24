import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { PenLine, Star, Store } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ReviewModerationNotice } from "@/components/review";
import { AccessibleImage, AppText, Button, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { tapHaptic } from "@/lib/haptics";
import { OwnReviewMenuButton, useOwnReviewEditor } from "@/features/profile/useOwnReviewEditor";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import type { Review } from "@/types/domain";
import { isDishDetail } from "./profileGuards";
import { ProfileReviewsSkeleton } from "./ProfileGridSkeleton";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "ReviewHistory">;

/** Reviews per server page. */
const REVIEW_HISTORY_PAGE_SIZE = 50;

export function ReviewHistoryScreen({ navigation }: Props) {
  const { palette, spacing, radii, componentRadii, shadows } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const reviewEntries = useProfileStore((state) => state.reviewEntries);
  const repository = getDataRepository();
  const serviceProviderMode = getServiceProvider().mode;
  const [remoteReviews, setRemoteReviews] = useState<Review[]>([]);
  const [remoteLoadFailed, setRemoteLoadFailed] = useState(false);
  // False until the first read finishes, so "No reviews yet" never flashes while loading.
  const [remoteLoaded, setRemoteLoaded] = useState(serviceProviderMode === "mock");
  const [loadedRows, setLoadedRows] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Coming back from "Write another review" shows the new review without reopening the screen.
  const isFocused = useIsFocused();
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
    if (!isFocused) return;
    let active = true;
    setRemoteLoadFailed(false);

    if (serviceProviderMode === "mock" || !profile.id || profile.id === "guest-user") {
      setRemoteReviews([]);
      setRemoteLoaded(true);
      return () => {
        active = false;
      };
    }

    void getHungryService()
      .reviews.getUserReviews(profile.id, { limit: REVIEW_HISTORY_PAGE_SIZE, offset: 0 })
      .then((reviews) => {
        if (!active) return;
        setRemoteReviews(reviews);
        setLoadedRows(reviews.length);
        setHasMore(reviews.length === REVIEW_HISTORY_PAGE_SIZE);
        setRemoteLoaded(true);
      })
      .catch(() => {
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
    void getHungryService()
      .reviews.getUserReviews(profile.id, { limit: REVIEW_HISTORY_PAGE_SIZE, offset: loadedRows })
      .then((reviews) => {
        setRemoteReviews((current) => {
          const seen = new Set(current.map((review) => review.id));
          return [...current, ...reviews.filter((review) => !seen.has(review.id))];
        });
        setLoadedRows((current) => current + reviews.length);
        setHasMore(reviews.length === REVIEW_HISTORY_PAGE_SIZE);
      })
      .catch(() => undefined)
      .finally(() => setIsLoadingMore(false));
  };

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
  const ownRatings = historyItems
    .map(
      ({ review, dish }) => review?.rating ?? (dish ? reviewEntries[dish.id]?.rating : undefined),
    )
    .filter((rating): rating is number => typeof rating === "number" && rating > 0);
  const averageRating = ownRatings.length
    ? (ownRatings.reduce((total, rating) => total + rating, 0) / ownRatings.length).toFixed(1)
    : undefined;

  const openReviewFlow = () => {
    tapHaptic();
    const rootNavigation = getRootNavigation(navigation as any);
    rootNavigation.navigate("ReviewStack", { screen: "ReviewMain" });
  };

  const openDish = (dishId: string) => {
    getRootNavigation(navigation as any).navigate("DishDetail", { dishId });
  };

  return (
    <View style={{ flex: 1 }}>
      <ProfileScreenShell title="Reviews">
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
              <AppText variant="h1">{historyItems.length}</AppText>
              <AppText variant="micro" tone="secondary">
                Reviewed
              </AppText>
            </View>
            {averageRating ? (
              <>
                <View style={{ width: 1, height: spacing[8], backgroundColor: palette.border }} />
                <View style={{ alignItems: "center", gap: spacing[1] }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
                    <Star size={18} color={palette.starStroke} fill={palette.starFill} />
                    <AppText variant="h1">{averageRating}</AppText>
                  </View>
                  <AppText variant="micro" tone="secondary">
                    Your avg score
                  </AppText>
                </View>
              </>
            ) : null}
          </View>
        ) : null}
        {!remoteLoaded && !hasHistory ? (
          <ProfileReviewsSkeleton />
        ) : hasHistory ? (
          <>
            {historyItems.map(({ review, dish }, index) => {
              const entry = dish ? reviewEntries[dish.id] : undefined;
              const tags = review?.tags ?? entry?.tags ?? [];
              // Only the user's own rating: the dish average is never shown as theirs.
              const rating = review?.rating ?? entry?.rating;
              const reviewText = review?.text || entry?.text || "No written notes";
              const dishId = review?.dishId ?? dish?.id;
              const dishName = dish?.name ?? "Reviewed dish";
              const venue = dish ? repository.getVenueById(dish.venueId) : undefined;
              const imageUrl = review?.photos[0] ?? dish?.imageUrl;
              const ratingPill = rating ? (
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: palette.imageLabelSurface,
                    borderRadius: radii.pill,
                    flexDirection: "row",
                    gap: spacing[1],
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[1],
                  }}
                >
                  <Star size={14} color={palette.starStroke} fill={palette.starFill} />
                  <AppText variant="bodySmallBold" tone="inverse">
                    {rating.toFixed(1)}
                  </AppText>
                </View>
              ) : null;
              const card = (
                <View
                  style={[
                    shadows.card,
                    {
                      backgroundColor: palette.surface,
                      borderRadius: componentRadii.card,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: palette.border,
                      marginBottom: spacing[4],
                    },
                  ]}
                >
                  {imageUrl ? (
                    <View style={{ height: 210 }}>
                      <AccessibleImage
                        source={{ uri: imageUrl }}
                        decorative
                        contentFit="cover"
                        style={{ width: "100%", height: "100%" }}
                      />
                      {ratingPill ? (
                        <View style={{ position: "absolute", top: spacing[3], right: spacing[3] }}>
                          {ratingPill}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                  <View style={{ padding: spacing[4], gap: spacing[2] }}>
                    <View
                      style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing[2] }}
                    >
                      <AppText variant="h2" style={{ flex: 1 }}>
                        {dishName}
                      </AppText>
                      {dish ? (
                        <AppText variant="h2" style={{ color: palette.orange }}>
                          S${dish.price.toFixed(2)}
                        </AppText>
                      ) : null}
                    </View>
                    {!imageUrl && ratingPill ? (
                      <View style={{ alignSelf: "flex-start" }}>{ratingPill}</View>
                    ) : null}
                    {venue ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
                        <Store size={15} color={palette.orange} />
                        <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                          {venue.name}
                          {venue.unitNumber ? ` · ${venue.unitNumber}` : ""}
                        </AppText>
                      </View>
                    ) : null}
                    {rating ? (
                      <AppText variant="bodySmall" style={{ color: palette.ratingStar }}>
                        {"★".repeat(Math.round(rating))}
                        {"☆".repeat(5 - Math.round(rating))}
                      </AppText>
                    ) : null}
                    {tags.length ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1] }}>
                        {tags.map((tag) => (
                          <View
                            key={tag}
                            style={{
                              backgroundColor: palette.orangeLight,
                              borderRadius: radii.pill,
                              paddingHorizontal: spacing[2],
                              paddingVertical: 2,
                            }}
                          >
                            <AppText variant="micro" style={{ color: palette.orangeDark }}>
                              {tag}
                            </AppText>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {review?.moderationState ? (
                      <ReviewModerationNotice
                        state={review.moderationState}
                        reviewId={review.id}
                        dishName={dishName}
                      />
                    ) : null}
                    <View
                      style={{
                        backgroundColor: palette.surfaceRaised,
                        borderRadius: componentRadii.card,
                        padding: spacing[3],
                      }}
                    >
                      <AppText variant="bodySmall" tone="secondary" numberOfLines={4}>
                        {reviewText}
                      </AppText>
                    </View>
                    {review?.createdAt ? (
                      <AppText variant="micro" tone="secondary">
                        {new Date(review.createdAt).toLocaleDateString()}
                        {review.editedAt ? " · Edited" : ""}
                      </AppText>
                    ) : null}
                    {review && ownReviewEditor.enabled ? (
                      <View style={{ alignSelf: "flex-end" }}>
                        <OwnReviewMenuButton onPress={() => ownReviewEditor.openActions(review)} />
                      </View>
                    ) : null}
                  </View>
                </View>
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
        <PenLine size={24} color={palette.textOnPrimary} />
      </Pressable>
    </View>
  );
}
