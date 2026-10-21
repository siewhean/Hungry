/**
 * ReviewDetailScreen
 * One review on its own page: what a shared review link (usehungry.com/review/:id) opens.
 */
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { ReviewModerationNotice, ReviewPhotoViewer, StarRating } from "@/components/review";
import {
  AccessibleImage,
  AppText,
  Avatar,
  Button,
  EmptyState,
  Screen,
  Skeleton,
} from "@/components/ui";
import { webShareUrl } from "@/constants/links";
import { shareLink } from "@/features/share/messagingShare";
import { isContentHiddenForSession } from "@/lib/security/communitySafety";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { RecentReviewFeedEntry } from "@/lib/services/types";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ReviewDetail">;

export function ReviewDetailScreen({ navigation, route }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const { reviewId } = route.params;
  const viewerId = useProfileStore((state) => state.profile.id);
  const [entry, setEntry] = useState<RecentReviewFeedEntry | null>(null);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHungryService()
      .reviews.getReviewById(reviewId)
      .then((found) => {
        if (cancelled) return;
        setEntry(found);
        setState("done");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reviewId, attempt]);

  const retry = useCallback(() => {
    setState("loading");
    setAttempt((current) => current + 1);
  }, []);
  const goHome = useCallback(
    () => navigation.navigate("MainTabs", { screen: "Review" }),
    [navigation],
  );

  const review = entry?.review;
  const hidden = review && isContentHiddenForSession({ id: review.id, authorId: review.authorId });

  if (state === "loading") {
    return (
      <Screen title="Review">
        <View accessibilityLabel="Loading review" style={{ gap: spacing[3] }}>
          <Skeleton width="100%" height={48} />
          <Skeleton width="100%" height={120} />
          <Skeleton width="60%" height={20} />
        </View>
      </Screen>
    );
  }

  if (state === "error") {
    return (
      <Screen title="Review">
        <EmptyState
          title="Couldn't load this review"
          body="Check your connection and try again."
          ctaLabel="Try again"
          onPress={retry}
        />
      </Screen>
    );
  }

  if (!entry || !review || hidden) {
    return (
      <Screen title="Review">
        <EmptyState
          title="This review isn't available"
          body="It may have been removed by its author."
          ctaLabel="See other reviews"
          onPress={goHome}
        />
      </Screen>
    );
  }

  const isOwn = Boolean(review.authorId && review.authorId === viewerId);
  const dateLabel = `${new Date(review.createdAt).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}${review.editedAt ? " · edited" : ""}`;

  return (
    <Screen title={entry.dishName} subtitle={entry.venueName}>
      <View style={{ gap: spacing[4] }}>
        {review.moderationState ? (
          <ReviewModerationNotice
            state={review.moderationState}
            reviewId={review.id}
            dishName={entry.dishName}
          />
        ) : null}

        <View
          style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}
        >
          <Pressable
            accessibilityRole={review.authorId && !isOwn ? "button" : undefined}
            accessibilityLabel={`${review.authorName}${review.authorId && !isOwn ? ", open profile" : ""}`}
            disabled={!review.authorId || isOwn}
            onPress={() =>
              review.authorId
                ? navigation.navigate("UserProfile", {
                    authorId: review.authorId,
                    authorName: review.authorName,
                    authorAvatarUrl: review.authorAvatarUrl,
                  })
                : undefined
            }
            style={{
              alignItems: "center",
              flexDirection: "row",
              flexShrink: 1,
              gap: spacing[2],
              minHeight: 44,
            }}
          >
            <Avatar uri={review.authorAvatarUrl} name={review.authorName} size={40} />
            <View style={{ flexShrink: 1 }}>
              <AppText variant="bodySmallBold">{review.authorName}</AppText>
              <AppText variant="micro" tone="muted">
                {dateLabel}
              </AppText>
            </View>
          </Pressable>
          <StarRating value={review.rating} />
        </View>

        {review.photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              {review.photos.map((uri, index) => (
                <Pressable
                  key={`${index}:${uri}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Open photo ${index + 1} of ${review.photos.length}`}
                  onPress={() => setViewerIndex(index)}
                >
                  <AccessibleImage
                    source={{ uri }}
                    decorative
                    style={{ borderRadius: radii.md, height: 180, width: 180 }}
                    contentFit="cover"
                  />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : null}

        <AppText variant="body">{review.text}</AppText>

        {review.tags.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {review.tags.map((tag) => (
              <View
                key={tag}
                style={{
                  backgroundColor: palette.bgSoft,
                  borderRadius: radii.sm,
                  paddingHorizontal: spacing[2],
                  paddingVertical: 4,
                }}
              >
                <AppText variant="micro" tone="secondary" style={{ fontWeight: "600" }}>
                  {tag}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        {review.merchantReply?.text ? (
          <View
            accessible
            accessibilityLabel={`Reply from the stall: ${review.merchantReply.text}`}
            style={{
              backgroundColor: palette.bgSoft,
              borderRadius: radii.md,
              gap: spacing[1],
              padding: spacing[3],
            }}
          >
            <AppText variant="micro" tone="secondary" style={{ fontWeight: "700" }}>
              Reply from {entry.venueName}
            </AppText>
            <AppText variant="bodySmall">{review.merchantReply.text}</AppText>
          </View>
        ) : null}

        <Button
          label={`See ${entry.dishName}`}
          onPress={() => navigation.navigate("DishDetail", { dishId: entry.dishId })}
        />
        {review.moderationState ? null : (
          <Button
            label="Share this review"
            variant="secondary"
            onPress={() =>
              void shareLink(
                {
                  kind: "review",
                  id: review.id,
                  message: `${review.authorName} reviewed ${entry.dishName} at ${entry.venueName} on Hungry`,
                  url: webShareUrl("review", review.id),
                },
                "system_share",
              )
            }
          />
        )}
      </View>
      {viewerIndex !== null ? (
        <ReviewPhotoViewer
          photos={review.photos}
          initialIndex={viewerIndex}
          label={`${entry.dishName} review`}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </Screen>
  );
}
