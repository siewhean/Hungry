import { Pressable, View } from "react-native";

import { AppText, Avatar } from "@/components/ui";
import {
  CaptionPreview,
  OwnReviewActions,
  ReviewMoreButton,
  ReviewPhotoStrip,
  ReviewReaderActions,
  ReviewStars,
} from "@/components/review";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import type { PendingRoute } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import type { Review } from "@/types/domain";

type Props = {
  review: Review;
  dishName: string;
  /** The signed-in diner wrote this review: they can edit or delete it. */
  isOwn: boolean;
  returnRoute: PendingRoute;
  onOpenAuthor: (review: Review) => void;
  onUpdated: (patch: Partial<Review>) => void;
  onDeleted: () => void;
  /** The review was reported or its author blocked: drop it from the list. */
  onRemoved: () => void;
};

/** One review on a dish page: who and how many stars, the text, photos, owner reply, date and Helpful. */
export function DishReviewCard({
  review,
  dishName,
  isOwn,
  returnRoute,
  onOpenAuthor,
  onUpdated,
  onDeleted,
  onRemoved,
}: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderWidth: 1,
        gap: spacing[2],
        padding: spacing[4],
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
        {/* One stop per author: avatar and name together, a link only with an account. */}
        <Pressable
          accessible
          accessibilityRole={review.authorId ? "link" : undefined}
          accessibilityLabel={
            review.authorId ? `Open ${review.authorName}'s profile` : review.authorName
          }
          disabled={!review.authorId}
          onPress={() => onOpenAuthor(review)}
          style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: spacing[3] }}
        >
          <Avatar uri={review.authorAvatarUrl} name={review.authorName} size={36} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText style={{ fontWeight: "900" }} numberOfLines={1}>
              {review.authorName}
            </AppText>
            <ReviewStars rating={review.rating} />
          </View>
        </Pressable>
        {isOwn ? null : (
          <ReviewMoreButton review={review} returnRoute={returnRoute} onRemoved={onRemoved} />
        )}
      </View>
      <CaptionPreview text={review.text} />
      <ReviewPhotoStrip
        photos={review.photos}
        subject={`${dishName}, review by ${review.authorName}`}
      />
      {isOwn ? (
        <OwnReviewActions review={review} onUpdated={onUpdated} onDeleted={onDeleted} />
      ) : null}
      {review.merchantReply ? (
        <View
          style={{
            backgroundColor: palette.bgSoft,
            borderRadius: componentRadii.card,
            gap: spacing[1],
            padding: spacing[3],
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
      {/* One footer line: when it was written, and "Helpful" on someone else's review. */}
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <AppText variant="micro" tone="muted">
          {formatTimeAgo(review.createdAt)}
        </AppText>
        <ReviewReaderActions
          key={review.id}
          review={review}
          isOwn={isOwn}
          returnRoute={returnRoute}
          onRemoved={onRemoved}
          variant="helpful"
        />
      </View>
    </View>
  );
}
