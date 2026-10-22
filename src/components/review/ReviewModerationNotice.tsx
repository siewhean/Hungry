import { View } from "react-native";

import {
  buildReviewAppealMailto,
  describeReviewModeration,
} from "@/features/review/reviewModeration";
import { openTrustedExternalUrl } from "@/lib/security/safeLinking";
import { useHungryTheme } from "@/theme";
import type { Review } from "@/types/domain";
import { AppText, Button } from "../ui";

type ReviewModerationNoticeProps = {
  state: NonNullable<Review["moderationState"]>;
  reviewId: string;
  dishName?: string;
};

/** Shown on the author's own review when it is hidden or removed for everyone else. */
export function ReviewModerationNotice({ state, reviewId, dishName }: ReviewModerationNoticeProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const { title, body } = describeReviewModeration(state);
  return (
    <View
      accessible={false}
      style={{
        backgroundColor: palette.bgSoft,
        borderColor: palette.border,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing[2],
        padding: spacing[3],
      }}
    >
      <AppText variant="bodySmallBold">{title}</AppText>
      <AppText variant="bodySmall" tone="secondary">
        {body}
      </AppText>
      <Button
        label="Request review"
        variant="secondary"
        fullWidth={false}
        onPress={() => void openTrustedExternalUrl(buildReviewAppealMailto({ reviewId, dishName }))}
      />
    </View>
  );
}
