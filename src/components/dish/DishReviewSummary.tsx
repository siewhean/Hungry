import { View } from "react-native";
import { Star } from "lucide-react-native";

import { AppText, Chip } from "@/components/ui";
import {
  MIN_REVIEWS_FOR_SUMMARY,
  REVIEW_SORT_OPTIONS,
  ratingsHeadline,
  type ReviewSort,
  type ReviewSummary,
} from "@/features/detail/dishReviewSummary";
import { useHungryTheme } from "@/theme";

type Props = {
  /** The dish's rating and how many star ratings it has (all of them, written or not). */
  rating: number;
  ratingCount: number;
  summary: ReviewSummary;
  /** More written reviews exist than are loaded. */
  hasMore: boolean;
  sort: ReviewSort;
  onSort: (sort: ReviewSort) => void;
  withPhotos: boolean;
  onToggleWithPhotos: () => void;
  /** At least one loaded review has a photo, so the filter can show something. */
  anyPhotos: boolean;
  /** The sort and filter chips: off on the dish page's short preview, on in the full list. */
  showTools: boolean;
  /** The histogram and "People mention" words; off leaves only the count line (the A/B control). */
  showBreakdown?: boolean;
};

/**
 * Above the reviews: the score, "118 ratings · 1 written review", a star histogram and the
 * words several diners used, then (when there is something to sort) sort and photo chips.
 * The histogram and words describe the written reviews that are loaded, and say so.
 */
export function DishReviewSummary({
  rating,
  ratingCount,
  summary,
  hasMore,
  sort,
  onSort,
  withPhotos,
  onToggleWithPhotos,
  anyPhotos,
  showTools,
  showBreakdown = true,
}: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const headline = ratingsHeadline(ratingCount, summary.total, hasMore);
  const showHistogram = showBreakdown && summary.total >= MIN_REVIEWS_FOR_SUMMARY;
  const maxCount = Math.max(1, ...summary.counts);

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
        {ratingCount > 0 ? (
          <>
            <Star color={palette.starStroke} fill={palette.starFill} size={18} />
            <AppText variant="h3">{rating.toFixed(1)}</AppText>
          </>
        ) : null}
        <AppText variant="bodySmall" tone="secondary" accessibilityRole="text">
          {headline}
        </AppText>
      </View>

      {showHistogram ? (
        <View
          testID="dish-review-histogram"
          accessible
          accessibilityLabel={[5, 4, 3, 2, 1]
            .map((star) => `${summary.counts[star - 1]} at ${star} stars`)
            .join(", ")}
          style={{ gap: spacing[1] }}
        >
          {[5, 4, 3, 2, 1].map((star) => (
            <View
              key={star}
              style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}
            >
              <AppText variant="micro" tone="secondary" style={{ width: 12 }}>
                {star}
              </AppText>
              <View
                style={{
                  backgroundColor: palette.bgSoft,
                  borderRadius: radii.pill,
                  flex: 1,
                  height: 8,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    backgroundColor: palette.starFill,
                    borderRadius: radii.pill,
                    height: 8,
                    width: `${(summary.counts[star - 1] / maxCount) * 100}%`,
                  }}
                />
              </View>
              <AppText variant="micro" tone="secondary" style={{ textAlign: "right", width: 24 }}>
                {summary.counts[star - 1]}
              </AppText>
            </View>
          ))}
          <AppText variant="micro" tone="muted">
            {hasMore ? "Stars in the written reviews loaded so far" : "Stars in written reviews"}
          </AppText>
        </View>
      ) : null}

      {showBreakdown && summary.mentioned.length > 0 ? (
        <View style={{ gap: spacing[1] }}>
          <AppText variant="bodySmallBold">People mention</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {summary.mentioned.map((entry) => (
              <Chip key={entry.tag} label={`${entry.tag} · ${entry.count}`} />
            ))}
          </View>
        </View>
      ) : null}

      {showTools && summary.total > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          {REVIEW_SORT_OPTIONS.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              accessibilityLabel={`Sort by ${option.label.toLowerCase()}`}
              selected={sort === option.id}
              onPress={() => onSort(option.id)}
            />
          ))}
          {anyPhotos ? (
            <Chip
              label="With photos"
              accessibilityLabel="Only reviews with photos"
              selected={withPhotos}
              onPress={onToggleWithPhotos}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
