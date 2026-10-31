/**
 * ReviewDetailScreen
 * One review on its own page: what a shared review link (usehungry.com/review/:id) opens.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronRight, MoreHorizontal } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  ReviewModerationNotice,
  ReviewPhotoViewer,
  ReviewReaderActions,
} from "@/components/review";
import {
  AccessibleImage,
  AppText,
  Avatar,
  Button,
  EmptyState,
  IconButton,
  Screen,
  Skeleton,
} from "@/components/ui";
import { webShareUrl } from "@/constants/links";
import { useRequireAccount } from "@/features/auth/useRequireAccount";
import { useOwnReviewEditor } from "@/features/profile/useOwnReviewEditor";
import { shareLink } from "@/features/share/messagingShare";
import { reportError } from "@/lib/monitoring/reportError";
import {
  isContentHiddenForSession,
  promptReviewSafetyActions,
} from "@/lib/security/communitySafety";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { RecentReviewFeedEntry } from "@/lib/services/types";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ReviewDetail">;

/** Photo shape on the review page: 4 wide to 5 tall, the way the grid sells it. */
const HERO_ASPECT_RATIO = 4 / 5;

/**
 * The review's photos at full width, one at a time with dots under them. A tap opens the
 * full-screen viewer on that photo.
 */
function ReviewPhotoHero({
  photos,
  onOpen,
}: {
  photos: string[];
  onOpen: (index: number) => void;
}) {
  const { palette, radii, spacing } = useHungryTheme();
  const { width: windowWidth } = useWindowDimensions();
  // The page's own width once laid out; until then a width that fits a phone's screen padding.
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const width = measuredWidth ?? Math.max(windowWidth - spacing[4] * 2, 1);
  const height = Math.round(width / HERO_ASPECT_RATIO);

  const handleLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== measuredWidth) setMeasuredWidth(next);
  };
  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1)));
  };

  return (
    <View testID="review-photo-hero" onLayout={handleLayout} style={{ gap: spacing[2] }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={{ borderRadius: radii.md, height, width: "100%" }}
      >
        {photos.map((uri, photoIndex) => (
          <Pressable
            key={`${photoIndex}:${uri}`}
            accessibilityRole="button"
            accessibilityLabel={`Open photo ${photoIndex + 1} of ${photos.length}`}
            onPress={() => onOpen(photoIndex)}
          >
            <AccessibleImage
              source={{ uri }}
              decorative
              style={{ backgroundColor: palette.bgSoft, height, width }}
              contentFit="cover"
            />
          </Pressable>
        ))}
      </ScrollView>
      {photos.length > 1 ? (
        <View
          accessibilityLabel={`Photo ${Math.min(index + 1, photos.length)} of ${photos.length}`}
          style={{ flexDirection: "row", gap: spacing[1.5], justifyContent: "center" }}
        >
          {photos.map((uri, dotIndex) => (
            <View
              key={`${dotIndex}:${uri}`}
              style={{
                backgroundColor: dotIndex === index ? palette.orange : palette.border,
                borderRadius: radii.pill,
                height: 6,
                width: 6,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ReviewDetailScreen({ navigation, route }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const { reviewId } = route.params;
  const viewerId = useProfileStore((state) => state.profile.id);
  const showToast = useUIStore((state) => state.showToast);
  const requireAccount = useRequireAccount();
  const [entry, setEntry] = useState<RecentReviewFeedEntry | null>(null);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [deleted, setDeleted] = useState(false);
  // Bumped after a report or block so the page re-checks whether the review is hidden.
  const [, setSafetyVersion] = useState(0);
  const loadedIdRef = useRef<string | null>(null);

  // Loads on focus, so an edit made elsewhere (the dish page) shows on Back. Only the first
  // load (or a retry) shows the skeleton; a refocus refreshes in place.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const firstLoad = loadedIdRef.current !== reviewId;
      if (firstLoad) setState("loading");
      getHungryService()
        .reviews.getReviewById(reviewId)
        .then((found) => {
          if (cancelled) return;
          loadedIdRef.current = reviewId;
          setEntry(found);
          setState("done");
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          reportError(error, { screen: "ReviewDetailScreen", action: "load_review" });
          // A failed refresh keeps the review on screen.
          if (firstLoad) setState("error");
        });
      return () => {
        cancelled = true;
      };
    }, [reviewId, attempt]),
  );

  const retry = useCallback(() => {
    loadedIdRef.current = null;
    setState("loading");
    setAttempt((current) => current + 1);
  }, []);
  const goHome = useCallback(
    () => navigation.navigate("MainTabs", { screen: "Review" }),
    [navigation],
  );
  const refreshSafety = useCallback(() => setSafetyVersion((current) => current + 1), []);

  const ownReviewEditor = useOwnReviewEditor({
    onUpdated: (updated) =>
      setEntry((current) =>
        current
          ? {
              ...current,
              review: { ...current.review, ...updated, editedAt: new Date().toISOString() },
            }
          : current,
      ),
    onDeleted: () => {
      setDeleted(true);
      if (navigation.canGoBack()) navigation.goBack();
    },
  });

  const review = entry?.review;
  const hidden = review && isContentHiddenForSession({ id: review.id, authorId: review.authorId });
  const isOwn = Boolean(review?.authorId && review.authorId === viewerId);
  const returnRoute = useMemo(() => ({ name: "ReviewDetail", params: { reviewId } }), [reviewId]);

  const openMenu = useCallback(() => {
    if (!review) return;
    if (isOwn) {
      ownReviewEditor.openActions(review);
      return;
    }
    if (!requireAccount("Sign in to report or block.", returnRoute)) return;
    promptReviewSafetyActions({
      reviewId: review.id,
      authorName: review.authorName,
      authorId: review.authorId,
      onHidden: refreshSafety,
      onBlocked: refreshSafety,
    });
  }, [isOwn, ownReviewEditor, refreshSafety, requireAccount, returnRoute, review]);

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

  if (!entry || !review || hidden || deleted) {
    return (
      <Screen title="Review">
        <EmptyState
          title="This review isn't available"
          body={
            hidden
              ? "You blocked or reported this review, so it's hidden for you."
              : deleted
                ? "You deleted this review."
                : "It may have been removed, or the link is wrong."
          }
          ctaLabel="See other reviews"
          onPress={goHome}
        />
      </Screen>
    );
  }

  const dateLabel = `${new Date(review.createdAt).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}${review.editedAt ? " · edited" : ""}`;

  const menuButton =
    isOwn && !ownReviewEditor.enabled ? undefined : (
      <IconButton
        variant="ghost"
        accessibilityLabel={isOwn ? "Manage your review" : "More options"}
        accessibilityHint={
          isOwn ? "Edit or delete this review" : "Report this review or block its author"
        }
        onPress={openMenu}
        icon={<MoreHorizontal color={palette.textSecondary} size={20} />}
      />
    );

  return (
    <Screen title={entry.dishName} subtitle={entry.venueName} headerRight={menuButton}>
      <View style={{ gap: spacing[4] }}>
        {review.moderationState ? (
          <ReviewModerationNotice
            state={review.moderationState}
            reviewId={review.id}
            dishName={entry.dishName}
          />
        ) : null}

        {review.photos.length > 0 ? (
          <ReviewPhotoHero photos={review.photos} onOpen={setViewerIndex} />
        ) : null}

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

        {/* The stars (read-only, 14pt) and, on someone else's review, the like. */}
        <ReviewReaderActions
          key={review.id}
          review={review}
          isOwn={isOwn}
          rating={review.rating}
          returnRoute={returnRoute}
          onRemoved={refreshSafety}
        />

        {entry.venueId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${entry.venueName || "the stall"}`}
            onPress={() => navigation.navigate("StallDetail", { id: entry.venueId })}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[1],
              minHeight: 44,
            }}
          >
            <AppText variant="bodySmallBold" style={{ flexShrink: 1 }} numberOfLines={1}>
              {entry.dishName}
              {entry.venueName ? ` at ${entry.venueName}` : ""}
            </AppText>
            <ChevronRight color={palette.textMuted} size={16} />
          </Pressable>
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

        {isOwn ? null : (
          <Button
            label="I had this too"
            variant="secondary"
            onPress={() =>
              navigation.navigate("ReviewStack", {
                screen: "ReviewMain",
                params: { dishId: entry.dishId, venueId: entry.venueId || undefined },
              })
            }
          />
        )}
        <Button
          label={`See ${entry.dishName}`}
          onPress={() =>
            navigation.navigate("DishDetail", { dishId: entry.dishId, source: "review_detail" })
          }
        />
        {review.moderationState ? null : (
          <Button
            label="Share this review"
            variant="secondary"
            onPress={() =>
              shareLink(
                {
                  kind: "review",
                  id: review.id,
                  message: `${review.authorName} reviewed ${entry.dishName} at ${entry.venueName} on Hungry`,
                  url: webShareUrl("review", review.id),
                },
                "system_share",
              ).catch((error: unknown) => {
                reportError(error, { screen: "ReviewDetailScreen", action: "share_review" });
                showToast({ message: "Couldn't open sharing. Try again.", tone: "warning" });
              })
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
      {ownReviewEditor.dialog}
    </Screen>
  );
}
