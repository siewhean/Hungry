import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Check, Trophy } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui";
import type { ReviewTasteTag } from "@/types/domain";
import { REVIEW_TASTE_TAG_META } from "@/types/domain";

interface ReviewSuccessCardProps {
  dishName: string;
  stallName: string;
  rating: number;
  selectedTags: ReviewTasteTag[];
  /** Points earned for this review */
  pointsEarned?: number;
  /** Total accumulated points */
  totalPoints?: number;
  /** User's current level name */
  levelName?: string;
  /** Progress to next level, 0–1 */
  levelProgress?: number;
}

/**
 * Gamification success card shown after completing a quick review.
 * Per Figma V2: gradient orange card with points, level progress, and review summary.
 */
export function ReviewSuccessCard({
  dishName,
  stallName,
  rating,
  selectedTags,
  pointsEarned = 25,
  totalPoints = 150,
  levelName = "Level 3 Foodie",
  levelProgress = 0.6,
}: ReviewSuccessCardProps) {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();

  return (
    <View style={[styles.card, { gap: spacing[5] }]}>
      {/* Points earned badge */}
      <LinearGradient
        colors={[palette.orange, palette.amber]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.pointsCard, { borderRadius: componentRadii.card, padding: spacing[5] }]}
      >
        <View
          style={[styles.checkCircle, { backgroundColor: palette.white, marginBottom: spacing[3] }]}
        >
          <Check color={palette.orange} size={32} strokeWidth={3} />
        </View>

        <AppText
          variant="h1"
          style={{ color: palette.white, textAlign: "center", fontWeight: "800" }}
        >
          +{pointsEarned} pts
        </AppText>
        <AppText
          variant="bodySmall"
          style={{ color: palette.inverseTextSecondary, textAlign: "center" }}
        >
          Review submitted!
        </AppText>

        {/* Level progress */}
        <View style={[styles.levelRow, { gap: spacing[2], marginTop: spacing[4] }]}>
          <Trophy color={palette.white} size={16} />
          <AppText variant="bodySmall" style={{ color: palette.white, fontWeight: "700" }}>
            {levelName}
          </AppText>
          <AppText variant="micro" style={{ color: palette.inverseTextMuted }}>
            {totalPoints} pts
          </AppText>
        </View>

        <View
          style={[
            styles.progressTrack,
            {
              backgroundColor: palette.inverseSurfaceStrong,
              borderRadius: radii.pill,
              marginTop: spacing[2],
            },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: palette.white,
                borderRadius: radii.pill,
                width: `${Math.min(levelProgress * 100, 100)}%`,
              },
            ]}
          />
        </View>
      </LinearGradient>

      {/* Review summary */}
      <View style={[styles.summary, { gap: spacing[3], padding: spacing[4] }]}>
        <AppText variant="h3" style={{ color: palette.text }}>
          Your review
        </AppText>

        <View style={{ gap: spacing[1] }}>
          <AppText variant="bodyBold" style={{ color: palette.text }}>
            {dishName}
          </AppText>
          <AppText variant="bodySmall" style={{ color: palette.textSecondary }}>
            {stallName}
          </AppText>
        </View>

        <View style={styles.starsRow}>
          {Array.from({ length: 5 }, (_, i) => (
            <AppText key={i} style={{ fontSize: 20 }}>
              {i < rating ? "★" : "☆"}
            </AppText>
          ))}
        </View>

        {selectedTags.length > 0 && (
          <View style={[styles.tagsRow, { gap: spacing[2] }]}>
            {selectedTags.map((tag) => {
              const meta = REVIEW_TASTE_TAG_META[tag];
              return (
                <View
                  key={tag}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: palette.orangeLight,
                      paddingHorizontal: spacing[2.5],
                      paddingVertical: spacing[1],
                      borderRadius: radii.pill,
                    },
                  ]}
                >
                  <AppText style={{ fontSize: 12 }}>{meta.emoji}</AppText>
                  <AppText variant="micro" style={{ color: palette.orange, fontWeight: "600" }}>
                    {meta.label}
                  </AppText>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "stretch",
  },
  pointsCard: {
    alignItems: "center",
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressTrack: {
    width: "100%",
    height: 6,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
  },
  summary: {
    borderWidth: 0,
  },
  starsRow: {
    flexDirection: "row",
    gap: 4,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
