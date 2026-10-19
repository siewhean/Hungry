import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { PartyPopper } from "lucide-react-native";

import { AppText } from "@/components/ui";
import type { WeeklyGoalProgress } from "@/features/passport/weeklyGoal";
import { useHungryTheme } from "@/theme";

interface WeeklyGoalCardProps {
  progress: WeeklyGoalProgress;
  /** True for a moment after this week's goal is first met. */
  celebrating: boolean;
  reduceMotion: boolean;
}

/** "This week's goal" on the Passport: a progress bar, weeks met and the next milestone. */
export function WeeklyGoalCard({ progress, celebrating, reduceMotion }: WeeklyGoalCardProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const pop = useSharedValue(1);

  useEffect(() => {
    if (!celebrating || reduceMotion) return;
    pop.value = withSequence(withTiming(1.05, { duration: 180 }), withSpring(1));
    return () => {
      cancelAnimation(pop);
      pop.value = 1;
    };
  }, [celebrating, pop, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const ratio = Math.min(1, progress.count / progress.target);
  const weeksLabel = `${progress.weeksCompleted} ${progress.weeksCompleted === 1 ? "week" : "weeks"} met`;
  const milestoneLabel = progress.nextMilestone
    ? ` · next: ${progress.nextMilestone.title} (${progress.nextMilestone.weeks} weeks)`
    : "";

  return (
    <Animated.View
      accessible
      accessibilityLabel={`This week's goal: ${progress.count} of ${progress.target} tried. ${weeksLabel}.`}
      style={[
        {
          backgroundColor: celebrating ? palette.orangeLight : palette.surface,
          borderColor: celebrating ? palette.orange : palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          gap: spacing[3],
          padding: spacing[4],
        },
        animatedStyle,
      ]}
    >
      <View style={{ gap: spacing[1] }}>
        <AppText variant="h3">This week&apos;s goal</AppText>
        <AppText tone="muted" variant="bodySmall">
          Try {progress.target} new dishes or stalls. A new goal starts every Monday, and a missed
          week never undoes your progress.
        </AppText>
      </View>

      <View
        style={{
          backgroundColor: palette.border,
          borderRadius: radii.pill,
          height: 8,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            backgroundColor: palette.orange,
            borderRadius: radii.pill,
            height: 8,
            width: `${ratio * 100}%`,
          }}
        />
      </View>

      {progress.completed ? (
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
          <PartyPopper size={18} color={palette.orangeDark} />
          <AppText style={{ color: palette.orangeDark }} variant="bodySmallBold">
            Goal complete for this week
          </AppText>
        </View>
      ) : (
        <AppText variant="bodySmallBold">
          {progress.count} of {progress.target} tried
        </AppText>
      )}
      <AppText tone="muted" variant="micro">
        {weeksLabel}
        {milestoneLabel}
      </AppText>
    </Animated.View>
  );
}
