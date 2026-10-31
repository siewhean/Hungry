import { Pressable, View } from "react-native";

import { AppText, Avatar } from "@/components/ui";
import {
  CaptionPreview,
  OwnReviewActions,
  ReviewMoreButton,
  ReviewPhotoStrip,
  ReviewReaderActions,
} from "@/components/review";
import type { StallCommunityReview } from "@/features/detail/detailTransforms";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import { useHungryTheme } from "@/theme";

type Props = {
  review: StallCommunityReview;
  venueId: string;
  /** The signed-in diner wrote this review: they can edit or delete it. */
  isOwn: boolean;
  onOpenAuthor: () => void;
  onOpenDish: () => void;
  onUpdated: (patch: { rating: number; text: string }) => void;
  /** The review was deleted or hidden: drop it from the list. */
  onRemoved: () => void;
};

/** One community review on the stall page: who, which dish, the text, photos, owner reply. */
export function StallReviewCard({
  review,
  venueId,
  isOwn,
  onOpenAuthor,
  onOpenDish,
  onUpdated,
  onRemoved,
}: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  return (
    <View
      style={{
        padding: spacing[4],
        borderRadius: componentRadii.card,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
      }}
    >
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: spacing[3],
        }}
      >
        <Pressable
          accessibilityRole={review.authorId ? "link" : undefined}
          accessibilityLabel={`Open ${review.authorName}'s profile`}
          disabled={!review.authorId}
          onPress={onOpenAuthor}
        >
          <Avatar uri={review.avatarUrl} name={review.authorName} size={40} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Pressable
            accessibilityRole={review.authorId ? "link" : undefined}
            accessibilityLabel={`Open ${review.authorName}'s profile`}
            disabled={!review.authorId}
            hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}
            onPress={onOpenAuthor}
          >
            <AppText style={{ fontWeight: "700" }}>{review.authorName}</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${review.dishName}`}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            onPress={onOpenDish}
          >
            <AppText variant="bodySmall" tone="accent" numberOfLines={1}>
              on {review.dishName}
            </AppText>
          </Pressable>
        </View>
        <AppText variant="micro" tone="muted">
          {formatTimeAgo(review.createdAt)}
        </AppText>
        {isOwn ? null : (
          <ReviewMoreButton
            review={{
              id: review.reviewId,
              authorId: review.authorId,
              authorName: review.authorName,
            }}
            returnRoute={{ name: "StallDetail", params: { venueId } }}
            onRemoved={onRemoved}
          />
        )}
      </View>
      <View style={{ marginTop: spacing[2] }}>
        <CaptionPreview text={review.text} />
      </View>

      {review.photos.length > 0 ? (
        <View style={{ marginTop: spacing[2] }}>
          <ReviewPhotoStrip
            photos={review.photos}
            subject={`${review.dishName}, review by ${review.authorName}`}
          />
        </View>
      ) : null}

      {isOwn ? (
        <View style={{ marginTop: spacing[2] }}>
          <OwnReviewActions
            review={{
              id: review.reviewId,
              rating: review.rating,
              text: review.text,
            }}
            onUpdated={onUpdated}
            onDeleted={onRemoved}
          />
        </View>
      ) : null}

      {review.merchantReply ? (
        <View
          style={{
            marginTop: spacing[2],
            padding: spacing[3],
            borderRadius: componentRadii.card,
            backgroundColor: palette.bgSoft,
            gap: spacing[1],
          }}
        >
          <AppText variant="micro" style={{ fontWeight: "700" }}>
            Reply from the owner
          </AppText>
          <AppText variant="bodySmall" tone="secondary">
            {review.merchantReply.text}
          </AppText>
        </View>
      ) : null}

      <View style={{ marginTop: spacing[2] }}>
        <ReviewReaderActions
          key={review.reviewId}
          rating={review.rating}
          review={{
            id: review.reviewId,
            authorId: review.authorId,
            authorName: review.authorName,
            helpfulCount: review.helpfulCount,
            viewerFoundHelpful: review.viewerFoundHelpful,
          }}
          isOwn={isOwn}
          returnRoute={{ name: "StallDetail", params: { venueId } }}
          onRemoved={onRemoved}
        />
      </View>
    </View>
  );
}
