import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { AccessibleImage, AppText, Card } from "@/components/ui";
import { ReviewModerationNotice } from "@/components/review";
import { formatRelativeDate } from "@/features/profile/relativeDate";
import type { ReviewDishInfo } from "@/features/profile/useReviewDishDetails";
import { useHungryTheme } from "@/theme";
import type { Review } from "@/types/domain";

type ProfileReviewCardProps = {
  review: Review;
  /** From useReviewDishDetails: "Loading…" while the lookup is on its way. */
  dish: ReviewDishInfo;
  /** Opens the dish; omit when the review has no dish to open. */
  onOpenDish?: () => void;
  /** The "..." button on your own cards; sits beside the pressable so a screen reader can reach it. */
  menu?: ReactNode;
  /** Show the tags the reviewer picked (Review history). */
  showTags?: boolean;
  testID?: string;
};

/**
 * One review on a profile, own or someone else's: the photo, dish, stall, stars, date and
 * notes. Your own review shows the photo you posted; otherwise the dish's catalog photo.
 */
export function ProfileReviewCard({
  review,
  dish,
  onOpenDish,
  menu,
  showTags = false,
  testID,
}: ProfileReviewCardProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const dishName =
    dish.status === "ready"
      ? dish.name
      : dish.status === "loading"
        ? "Loading…"
        : dish.status === "failed"
          ? "Couldn't load this dish"
          : "Dish no longer available";
  const stallName = dish.status === "ready" ? dish.stallName : undefined;
  const imageUrl = review.photos[0] ?? (dish.status === "ready" ? dish.imageUrl : undefined);
  const dateText = formatRelativeDate(review.createdAt);
  // An on-device entry with no rating (mock mode) shows no star.
  const rating = review.rating > 0 ? review.rating.toFixed(1) : undefined;

  const summary = (
    <>
      {imageUrl ? (
        <AccessibleImage
          source={{ uri: imageUrl }}
          accessibilityLabel={review.photos[0] ? `Your photo of ${dishName}` : dishName}
          contentFit="cover"
          style={{ borderRadius: radii.md, height: spacing[20], width: spacing[20] }}
        />
      ) : null}
      <View style={{ flex: 1, gap: spacing[1], minWidth: 0 }}>
        <AppText variant="bodyBold" numberOfLines={2}>
          {dishName}
        </AppText>
        {stallName ? (
          <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
            {stallName}
          </AppText>
        ) : null}
        {rating || dateText || review.editedAt ? (
          <AppText variant="bodySmall" tone="secondary">
            {rating ? (
              <>
                <Text style={{ color: palette.starFill }}>★</Text> {rating}
              </>
            ) : null}
            {[dateText, review.editedAt ? "Edited" : ""]
              .filter(Boolean)
              .map((part, index) => `${rating || index > 0 ? " · " : ""}${part}`)
              .join("")}
          </AppText>
        ) : null}
      </View>
    </>
  );
  const rowStyle = {
    alignItems: "center" as const,
    flex: 1,
    flexDirection: "row" as const,
    gap: spacing[3],
    minWidth: 0,
  };

  return (
    <Card style={{ gap: spacing[3], padding: spacing[3] }} testID={testID}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
        {onOpenDish ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Review of ${dishName}${review.rating > 0 ? `, rated ${review.rating} out of 5` : ""}`}
            accessibilityHint="Opens the dish"
            onPress={onOpenDish}
            style={rowStyle}
          >
            {summary}
          </Pressable>
        ) : (
          <View style={rowStyle}>{summary}</View>
        )}
        {menu}
      </View>
      {showTags && review.tags.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1] }}>
          {review.tags.map((tag) => (
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
      {review.moderationState ? (
        <ReviewModerationNotice
          state={review.moderationState}
          reviewId={review.id}
          dishName={dish.status === "ready" ? dish.name : undefined}
        />
      ) : null}
      {review.text ? (
        <View
          style={{
            backgroundColor: palette.bgSoft,
            borderRadius: radii.md,
            padding: spacing[3],
          }}
        >
          <AppText numberOfLines={4} style={{ fontStyle: "italic" }}>
            {review.text}
          </AppText>
        </View>
      ) : null}
    </Card>
  );
}
