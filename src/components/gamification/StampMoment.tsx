import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Target } from "lucide-react-native";

import { ACHIEVEMENT_ICONS } from "@/components/gamification/AchievementsSection";
import { PassportStampBadge } from "@/components/gamification/PassportStampBadge";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import * as Haptics from "@/lib/haptics";
import { useHungryTheme } from "@/theme";
import type { AchievementUnlock } from "@/features/achievements/unlocks";
import { milestoneReachedThisWeek, type WeeklyGoalProgress } from "@/features/passport/weeklyGoal";
import type { PassportCategory, PassportStampDefinition } from "@/types/domain";

export type StampMomentContent =
  | {
      kind: "stamp";
      stamp: PassportStampDefinition;
      category: PassportCategory;
      triedCount: number;
    }
  | { kind: "achievement"; unlock: AchievementUnlock }
  | { kind: "goal"; goal: WeeklyGoalProgress };

interface StampMomentProps {
  content: StampMomentContent;
  reduceMotion: boolean;
  onOpenPassport: () => void;
  onDismiss: () => void;
}

/**
 * The celebration straight after an action: a new stamp lands on the page with a spring and an
 * ink ring, or an achievement tier is reached. Reduce Motion gets the same card with no motion.
 */
export function StampMoment({
  content,
  reduceMotion,
  onOpenPassport,
  onDismiss,
}: StampMomentProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const landed = useSharedValue(reduceMotion ? 1 : 0);
  const ink = useSharedValue(0);
  const shake = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    // The stamp drops from large and tilted, bounces once, then the ink ring spreads.
    landed.value = withSpring(1, { damping: 11, stiffness: 190, mass: 0.9 });
    ink.value = withDelay(170, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
    shake.value = withDelay(
      170,
      withSequence(
        withTiming(-4, { duration: 45 }),
        withTiming(4, { duration: 60 }),
        withTiming(-2, { duration: 50 }),
        withTiming(0, { duration: 45 }),
      ),
    );
    const timers = [
      setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 170),
      setTimeout(
        () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        330,
      ),
    ];
    return () => timers.forEach(clearTimeout);
  }, [ink, landed, reduceMotion, shake]);

  const stampStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, landed.value * 3),
    transform: [{ scale: 1.7 - 0.7 * landed.value }, { rotate: `${-14 + 10 * landed.value}deg` }],
  }));
  const inkStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - ink.value),
    transform: [{ scale: 0.6 + 1.1 * ink.value }],
  }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const isStamp = content.kind === "stamp";
  const { body, heading, title } = momentText(content);
  const Icon = content.kind === "achievement" ? ACHIEVEMENT_ICONS[content.unlock.icon] : Target;

  return (
    <View
      accessibilityViewIsModal
      testID="stamp-moment"
      style={[styles.backdrop, { backgroundColor: palette.overlay, padding: spacing[5] }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onDismiss}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          cardStyle,
          {
            alignItems: "center",
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: componentRadii.card,
            borderWidth: 1,
            gap: spacing[3],
            maxWidth: 360,
            padding: spacing[5],
            width: "100%",
          },
        ]}
      >
        <AppText variant="bodySmallBold" tone="accent">
          {heading}
        </AppText>
        <View style={styles.art}>
          {reduceMotion ? null : (
            <Animated.View
              pointerEvents="none"
              style={[
                inkStyle,
                styles.inkRing,
                { borderColor: palette.orange, borderRadius: radii.pill },
              ]}
            />
          )}
          <Animated.View style={reduceMotion ? undefined : stampStyle}>
            {isStamp ? (
              <PassportStampBadge stamp={content.stamp} earned />
            ) : Icon ? (
              <View
                style={[
                  styles.achievementDisc,
                  { backgroundColor: palette.orange, borderRadius: radii.pill },
                ]}
              >
                <Icon size={44} color={palette.textOnOrange} />
              </View>
            ) : null}
          </Animated.View>
        </View>
        <View style={{ alignItems: "center", gap: spacing[1] }}>
          <AppText variant="h3" style={{ textAlign: "center" }}>
            {title}
          </AppText>
          <AppText tone="secondary" style={{ textAlign: "center" }}>
            {body}
          </AppText>
        </View>
        <View style={{ alignSelf: "stretch", gap: spacing[2] }}>
          <Button label="See my Passport" onPress={onOpenPassport} fullWidth />
          <Button label="Keep exploring" variant="ghost" onPress={onDismiss} fullWidth />
        </View>
      </Animated.View>
    </View>
  );
}

function momentText(content: StampMomentContent): {
  body: string;
  heading: string;
  title: string;
} {
  if (content.kind === "stamp") {
    const tried = content.triedCount;
    return {
      heading: "New stamp",
      title: content.category.name,
      body: `${content.stamp.title.split(": ").at(-1)}. ${tried} ${tried === 1 ? "stall" : "stalls"} tried.`,
    };
  }
  if (content.kind === "achievement") {
    const { unlock } = content;
    return {
      heading: "Achievement unlocked",
      title: unlock.title,
      body: `Level ${unlock.level} of ${unlock.totalLevels}. ${unlock.reached}.`,
    };
  }
  const milestone = milestoneReachedThisWeek(content.goal);
  return {
    heading: "Weekly goal",
    title: "Weekly goal complete",
    body: `${content.goal.count} new places tried this week.${milestone ? ` ${milestone.title}.` : ""}`,
  };
}

const styles = StyleSheet.create({
  achievementDisc: { alignItems: "center", height: 88, justifyContent: "center", width: 88 },
  art: { alignItems: "center", height: 130, justifyContent: "center", width: 200 },
  backdrop: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1000,
  },
  inkRing: { borderWidth: 3, height: 130, position: "absolute", width: 130 },
});
