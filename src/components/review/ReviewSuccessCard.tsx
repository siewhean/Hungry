import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui";
import type { ReviewTasteTag } from "@/types/domain";
import { REVIEW_TASTE_TAG_META } from "@/types/domain";

interface ReviewSuccessCardProps {
  pointsEarned: number;
  totalPoints: number;
  currentLevel: string;
  nextLevel: string;
  pointsToNextLevel: number;
  dishName: string;
  venueName: string;
  rating: number;
  selectedTags: ReviewTasteTag[];
}

/**
 * Gamification points card shown on review success.
 * Builds the habit loop by showing progress to next level.
 * Mirrors Figma V2 specs.
 */
export function ReviewSuccessCard({
  pointsEarned,
  totalPoints,
  currentLevel,
  nextLevel,
  pointsToNextLevel,
  dishName,
  venueName,
  rating,
  selectedTags,
}: ReviewSuccessCardProps) {
  const { palette, spacing, radii } = useHungryTheme();

  // Calculate progress percentage (mock logic for demo)
  const levelSize = 500; // Arbitrary points per level
  const progressPercent = Math.max(
    0,
    Math.min(100, ((levelSize - pointsToNextLevel) / levelSize) * 100),
  );

  return (
    <View style={{ width: "100%", alignItems: "center", gap: spacing[5] }}>
      {/* Success animation placeholder */}
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: "rgba(22, 163, 74, 0.15)", // var(--green-soft)
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AppText style={{ fontSize: 40 }}>✅</AppText>
      </View>

      <View style={{ alignItems: "center", gap: spacing[1] }}>
        <AppText variant="h2" style={{ textAlign: "center", fontWeight: "900", fontSize: 24 }}>
          Review posted!
        </AppText>
        <AppText variant="body" tone="secondary" style={{ textAlign: "center" }}>
          Thanks for helping the Hungry community find great food 🙏
        </AppText>
      </View>

      {/* Points earned (gamification) */}
      <LinearGradient
        colors={[palette.orange, palette.amber]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: radii.xl,
          padding: spacing[4],
          paddingHorizontal: spacing[6],
          alignItems: "center",
          width: "100%",
        }}
      >
        <AppText
          style={{
            fontFamily: "DMMono_400Regular",
            fontSize: 11,
            color: "rgba(255,255,255,0.75)",
            textTransform: "uppercase",
            letterSpacing: 0.8,
            marginBottom: spacing[1],
          }}
        >
          Points earned
        </AppText>
        <AppText style={{ fontSize: 32, fontWeight: "900", color: "#FFFFFF" }}>
          +{pointsEarned} pts
        </AppText>
        <AppText style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
          Total: {totalPoints} pts · {currentLevel}
        </AppText>

        {/* Progress to next level */}
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.2)",
            borderRadius: radii.pill,
            height: 6,
            width: "100%",
            marginTop: spacing[3],
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              backgroundColor: "#FFFFFF",
              borderRadius: radii.pill,
            }}
          />
        </View>
        <AppText style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", marginTop: spacing[1] }}>
          {pointsToNextLevel} pts to {nextLevel}
        </AppText>
      </LinearGradient>

      {/* Review summary */}
      <View
        style={{
          width: "100%",
          backgroundColor: palette.bgSoft,
          borderRadius: radii.lg,
          padding: spacing[3],
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[2],
            marginBottom: spacing[2],
          }}
        >
          <AppText style={{ fontSize: 20 }}>🍜</AppText>
          <View style={{ flex: 1 }}>
            <AppText variant="bodySmall" style={{ fontWeight: "700" }}>
              {dishName}
            </AppText>
            <AppText variant="micro" tone="secondary">
              {venueName}
            </AppText>
          </View>
          <View style={{ flexDirection: "row", gap: 1 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <AppText
                key={i}
                style={{ color: i < rating ? palette.amber : palette.border, fontSize: 12 }}
              >
                ★
              </AppText>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1] }}>
          {selectedTags.map((tag) => {
            const meta = REVIEW_TASTE_TAG_META[tag];
            return (
              <View
                key={tag}
                style={{
                  backgroundColor: "rgba(232, 83, 30, 0.1)", // orange soft
                  borderRadius: radii.sm,
                  paddingHorizontal: spacing[2],
                  paddingVertical: 3,
                }}
              >
                <AppText
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: palette.orange,
                  }}
                >
                  {meta.emoji} {meta.label}
                </AppText>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
