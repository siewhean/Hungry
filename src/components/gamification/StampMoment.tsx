import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Target } from "lucide-react-native";

import { AchievementBadgeArt } from "@/components/gamification/AchievementBadgeArt";
import { PassportStampBadge } from "@/components/gamification/PassportStampBadge";
import { getStampLook, StampStar } from "@/components/gamification/PassportStampArt";
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

/** When the stamp hits the page, in ms from the moment opening. Everything else keys off it. */
export const STAMP_IMPACT_MS = 320;
const SPLATTER_DOTS = 10;

/**
 * The celebration straight after an action, staged like a rubber stamp: it lifts over the card,
 * slams down tilted, squashes on impact with a heavy tap, throws ink, then settles. The level
 * stars pop in one by one with a light tick each, then the words fade up. A completed (fourth
 * level) stamp gets a second gold ring. Reduce Motion gets the finished card, still, with one
 * success haptic.
 */
export function StampMoment({
  content,
  reduceMotion,
  onOpenPassport,
  onDismiss,
}: StampMomentProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const isStamp = content.kind === "stamp";
  const level = isStamp ? content.stamp.index : 0;
  const starCount = isStamp ? Math.min(4, level + 1) : 0;
  const completed =
    (isStamp && level >= 3) ||
    (content.kind === "achievement" && content.unlock.level >= content.unlock.totalLevels);
  // A slight, fixed tilt per stamp, so two stamps never land the same way.
  const tilt = isStamp ? (content.stamp.id.length % 2 === 0 ? -7 : 6) : -4;
  const inkColor = isStamp
    ? getStampLook(content.stamp.categoryId).ink(palette)
    : content.kind === "achievement"
      ? palette.medalGold
      : palette.orange;

  const drop = useSharedValue(reduceMotion ? 1 : 0);
  const squash = useSharedValue(1);
  const inkBurst = useSharedValue(reduceMotion ? 1 : 0);
  const goldBurst = useSharedValue(reduceMotion ? 1 : 0);
  const shake = useSharedValue(0);
  const words = useSharedValue(reduceMotion ? 1 : 0);
  const star0 = useSharedValue(reduceMotion ? 1 : 0);
  const star1 = useSharedValue(reduceMotion ? 1 : 0);
  const star2 = useSharedValue(reduceMotion ? 1 : 0);
  const star3 = useSharedValue(reduceMotion ? 1 : 0);
  const stars = [star0, star1, star2, star3];

  useEffect(() => {
    if (reduceMotion) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    const impact = STAMP_IMPACT_MS;
    // Lift and hover, then slam down fast.
    drop.value = withSequence(
      withTiming(0.35, { duration: impact - 120, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 120, easing: Easing.in(Easing.cubic) }),
    );
    // Squash on impact, then spring back to full size.
    squash.value = withDelay(
      impact,
      withSequence(
        withTiming(0.86, { duration: 60, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 7, stiffness: 260, mass: 0.6 }),
      ),
    );
    inkBurst.value = withDelay(
      impact,
      withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }),
    );
    if (completed) {
      goldBurst.value = withDelay(
        impact + 180,
        withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) }),
      );
    }
    shake.value = withDelay(
      impact,
      withSequence(
        withTiming(-5, { duration: 40 }),
        withTiming(5, { duration: 55 }),
        withTiming(-3, { duration: 50 }),
        withTiming(0, { duration: 45 }),
      ),
    );
    const firstStar = impact + 260;
    stars.forEach((value, index) => {
      if (index >= starCount) return;
      value.value = withDelay(
        firstStar + index * 120,
        withSequence(
          withTiming(1.3, { duration: 120, easing: Easing.out(Easing.back(2)) }),
          withSpring(1, { damping: 9, stiffness: 240 }),
        ),
      );
    });
    const wordsAt = firstStar + Math.max(1, starCount) * 120;
    words.value = withDelay(wordsAt, withTiming(1, { duration: 280 }));

    const timers = [
      setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), impact),
      ...Array.from({ length: starCount }, (_, index) =>
        setTimeout(() => void Haptics.selectionAsync(), firstStar + index * 120 + 60),
      ),
      setTimeout(
        () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        wordsAt,
      ),
    ];
    return () => timers.forEach(clearTimeout);
    // The moment is keyed by id, so this runs once per celebration.
  }, []);

  const stampStyle = useAnimatedStyle(() => {
    const t = drop.value;
    // 0 to 0.35 is the lift (rising, growing); 0.35 to 1 is the slam (falling onto the card).
    const lift = Math.min(1, t / 0.35);
    const fall = Math.max(0, (t - 0.35) / 0.65);
    const scale = (1.15 + 0.45 * lift - 0.6 * fall) * squash.value;
    return {
      opacity: Math.min(1, t * 4),
      transform: [
        { translateY: -34 * lift * (1 - fall) },
        { scale },
        { rotate: `${-18 * (1 - fall) + tilt * fall}deg` },
      ],
    };
  });
  const shadowStyle = useAnimatedStyle(() => {
    const t = drop.value;
    const fall = Math.max(0, (t - 0.35) / 0.65);
    return {
      opacity: t >= 1 ? 0 : 0.22 * Math.min(1, t * 3),
      transform: [{ scaleX: 0.55 + 0.45 * fall }, { scaleY: 0.55 + 0.45 * fall }],
    };
  });
  const inkStyle = useAnimatedStyle(() => ({
    opacity: inkBurst.value >= 1 ? 0 : 0.55 * (1 - inkBurst.value),
    transform: [{ scale: 0.7 + 1.0 * inkBurst.value }],
  }));
  const goldStyle = useAnimatedStyle(() => ({
    opacity: goldBurst.value >= 1 ? 0 : 0.8 * (1 - goldBurst.value),
    transform: [{ scale: 0.8 + 1.2 * goldBurst.value }],
  }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const wordsStyle = useAnimatedStyle(() => ({
    opacity: words.value,
    transform: [{ translateY: 10 * (1 - words.value) }],
  }));

  const { body, heading, title } = momentText(content);

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
            <>
              <Animated.View
                pointerEvents="none"
                style={[shadowStyle, styles.shadow, { backgroundColor: palette.text }]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  inkStyle,
                  styles.inkRing,
                  { borderColor: inkColor, borderRadius: radii.pill },
                ]}
              />
              {completed ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    goldStyle,
                    styles.inkRing,
                    { borderColor: palette.passportGold, borderRadius: radii.pill },
                  ]}
                />
              ) : null}
              {Array.from({ length: SPLATTER_DOTS }, (_, index) => (
                <SplatterDot key={index} index={index} progress={inkBurst} color={inkColor} />
              ))}
            </>
          )}
          <Animated.View style={reduceMotion ? undefined : stampStyle}>
            {isStamp ? (
              <PassportStampBadge stamp={content.stamp} earned hideStars />
            ) : content.kind === "achievement" ? (
              <AchievementBadgeArt
                icon={content.unlock.icon}
                level={content.unlock.level}
                totalLevels={content.unlock.totalLevels}
                size={112}
              />
            ) : (
              <View
                style={[
                  styles.achievementDisc,
                  { backgroundColor: palette.orange, borderRadius: radii.pill },
                ]}
              >
                <Target size={44} color={palette.textOnOrange} />
              </View>
            )}
          </Animated.View>
        </View>
        {starCount > 0 ? (
          <View
            accessible
            accessibilityLabel={`Level ${level + 1} of 4`}
            style={{ flexDirection: "row", gap: spacing[1.5] }}
          >
            {Array.from({ length: 4 }, (_, index) => (
              <LevelStar
                key={index}
                progress={stars[index]!}
                earned={index < starCount}
                color={inkColor}
                emptyColor={palette.border}
              />
            ))}
          </View>
        ) : null}
        <Animated.View
          style={[wordsStyle, { alignItems: "center", alignSelf: "stretch", gap: spacing[3] }]}
        >
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
      </Animated.View>
    </View>
  );
}

/** One drop of ink thrown out on impact, along its own angle. */
function SplatterDot({
  index,
  progress,
  color,
}: {
  index: number;
  progress: SharedValue<number>;
  color: string;
}) {
  const angle = (Math.PI * 2 * index) / SPLATTER_DOTS + (index % 2 ? 0.25 : -0.1);
  const reach = 58 + (index % 3) * 12;
  const dot = 4 + (index % 3) * 2;
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: t <= 0 || t >= 1 ? 0 : 0.85 * (1 - t),
      transform: [
        { translateX: Math.cos(angle) * reach * t },
        { translateY: Math.sin(angle) * reach * t },
        { scale: 1 - 0.5 * t },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          backgroundColor: color,
          borderRadius: dot,
          height: dot,
          position: "absolute",
          width: dot,
        },
      ]}
    />
  );
}

function LevelStar({
  progress,
  earned,
  color,
  emptyColor,
}: {
  progress: SharedValue<number>;
  earned: boolean;
  color: string;
  emptyColor: string;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: earned ? Math.min(1, progress.value * 2) : 1,
    transform: [{ scale: earned ? progress.value : 1 }],
  }));
  return (
    <Animated.View style={style}>
      <StampStar size={20} color={earned ? color : emptyColor} />
    </Animated.View>
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
  inkRing: { borderWidth: 3, height: 120, position: "absolute", width: 120 },
  shadow: { borderRadius: 60, bottom: 4, height: 16, opacity: 0, position: "absolute", width: 96 },
});
