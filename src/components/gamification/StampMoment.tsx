import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Target } from "lucide-react-native";

import { AchievementBadgeArt, medalMetal } from "@/components/gamification/AchievementBadgeArt";
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

type Palette = ReturnType<typeof useHungryTheme>["palette"];

/** When the stamp hits the page, in ms from the moment opening. Everything else keys off it. */
export const STAMP_IMPACT_MS = 320;
/** When a spinning medal lands face up, in ms from the moment opening. */
export const MEDAL_LAND_MS = 900;
const SPLATTER_DOTS = 10;
const STAR_STEP_MS = 120;
const MEDAL_SIZE = 112;
const MEDAL_RAYS = 10;
const CONFETTI_PIECES = 18;
const PIP_STEP_MS = 150;

/** When the words and buttons fade up: after the art has finished its entrance. */
export function momentWordsDelay(content: StampMomentContent): number {
  if (content.kind === "achievement") {
    return MEDAL_LAND_MS + 260 + content.unlock.totalLevels * PIP_STEP_MS;
  }
  const stars = content.kind === "stamp" ? Math.min(4, content.stamp.index + 1) : 1;
  return STAMP_IMPACT_MS + 260 + stars * STAR_STEP_MS;
}

/**
 * The celebration straight after an action. The card rises in over a dimmed screen, then the
 * art makes its entrance, and the words and buttons fade up last.
 *
 * - A stamp lands like a rubber stamp: it lifts, slams down tilted, squashes with a heavy tap,
 *   throws ink and settles; the level stars pop in one by one.
 * - An achievement medal is tossed like a coin: it spins up face on, lands with a ring of
 *   light, a glint runs across the metal, and the level pips light in their metal one by one.
 *   The last level of an achievement also throws confetti.
 *
 * Reduce Motion gets the finished card, still, with one success haptic.
 */
export function StampMoment({
  content,
  reduceMotion,
  onOpenPassport,
  onDismiss,
}: StampMomentProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  const words = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    enter.value = withSpring(1, { damping: 16, stiffness: 220, mass: 0.8 });
    const wordsAt = momentWordsDelay(content);
    words.value = withDelay(wordsAt, withTiming(1, { duration: 280 }));
    const timer = setTimeout(
      () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      wordsAt,
    );
    return () => clearTimeout(timer);
    // The moment is keyed by id, so this runs once per celebration.
  }, []);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, enter.value * 1.6) }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 2),
    transform: [{ translateY: 28 * (1 - enter.value) }, { scale: 0.92 + 0.08 * enter.value }],
  }));
  const wordsStyle = useAnimatedStyle(() => ({
    opacity: words.value,
    transform: [{ translateY: 10 * (1 - words.value) }],
  }));

  const { body, heading, title } = momentText(content);

  return (
    <View accessibilityViewIsModal testID="stamp-moment" style={styles.backdrop}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, backdropStyle, { backgroundColor: palette.overlay }]}
      />
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
            marginHorizontal: spacing[5],
            maxWidth: 360,
            padding: spacing[5],
            width: "90%",
          },
        ]}
      >
        <AppText variant="bodySmallBold" tone="accent">
          {heading}
        </AppText>
        {content.kind === "achievement" ? (
          <MedalReveal unlock={content.unlock} reduceMotion={reduceMotion} palette={palette} />
        ) : (
          <StampLanding content={content} reduceMotion={reduceMotion} palette={palette} />
        )}
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

/** A stamp (or the weekly goal disc) landing like a rubber stamp, with its level stars. */
function StampLanding({
  content,
  reduceMotion,
  palette,
}: {
  content: Exclude<StampMomentContent, { kind: "achievement" }>;
  reduceMotion: boolean;
  palette: Palette;
}) {
  const { radii, spacing } = useHungryTheme();
  const isStamp = content.kind === "stamp";
  const level = isStamp ? content.stamp.index : 0;
  const starCount = isStamp ? Math.min(4, level + 1) : 0;
  const completed = isStamp && level >= 3;
  // A slight, fixed tilt per stamp, so two stamps never land the same way.
  const tilt = isStamp ? (content.stamp.id.length % 2 === 0 ? -7 : 6) : -4;
  const inkColor = isStamp ? getStampLook(content.stamp.categoryId).ink(palette) : palette.orange;

  const drop = useSharedValue(reduceMotion ? 1 : 0);
  const squash = useSharedValue(1);
  const inkBurst = useSharedValue(reduceMotion ? 1 : 0);
  const goldBurst = useSharedValue(reduceMotion ? 1 : 0);
  const imprint = useSharedValue(reduceMotion ? 1 : 0);
  const shake = useSharedValue(0);
  const star0 = useSharedValue(reduceMotion ? 1 : 0);
  const star1 = useSharedValue(reduceMotion ? 1 : 0);
  const star2 = useSharedValue(reduceMotion ? 1 : 0);
  const star3 = useSharedValue(reduceMotion ? 1 : 0);
  const stars = [star0, star1, star2, star3];

  useEffect(() => {
    if (reduceMotion) return;
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
    // The ink soaks into the card around the stamp and stays, faintly.
    imprint.value = withDelay(impact, withTiming(1, { duration: 420 }));
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
        firstStar + index * STAR_STEP_MS,
        withSequence(
          withTiming(1.3, { duration: 120, easing: Easing.out(Easing.back(2)) }),
          withSpring(1, { damping: 9, stiffness: 240 }),
        ),
      );
    });

    const timers = [
      setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), impact),
      ...Array.from({ length: starCount }, (_, index) =>
        setTimeout(() => void Haptics.selectionAsync(), firstStar + index * STAR_STEP_MS + 60),
      ),
    ];
    return () => timers.forEach(clearTimeout);
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
        { translateX: shake.value },
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
  const imprintStyle = useAnimatedStyle(() => ({
    opacity: 0.1 * imprint.value,
    transform: [{ scale: 0.9 + 0.12 * imprint.value }, { rotate: `${tilt}deg` }],
  }));
  const goldStyle = useAnimatedStyle(() => ({
    opacity: goldBurst.value >= 1 ? 0 : 0.8 * (1 - goldBurst.value),
    transform: [{ scale: 0.8 + 1.2 * goldBurst.value }],
  }));

  return (
    <>
      <View testID="stamp-landing" style={styles.art}>
        <Animated.View
          pointerEvents="none"
          style={[imprintStyle, styles.imprint, { backgroundColor: inkColor }]}
        />
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
          {content.kind === "stamp" ? (
            <PassportStampBadge stamp={content.stamp} earned hideStars />
          ) : (
            <View
              style={[
                styles.goalDisc,
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
    </>
  );
}

/** An achievement medal tossed like a coin: spins up, lands with light, glints, lights its pips. */
function MedalReveal({
  unlock,
  reduceMotion,
  palette,
}: {
  unlock: AchievementUnlock;
  reduceMotion: boolean;
  palette: Palette;
}) {
  const { radii, spacing } = useHungryTheme();
  const { level, totalLevels } = unlock;
  const top = level >= totalLevels;
  const metal = medalMetal(level, totalLevels);
  const glowColor =
    metal === "bronze"
      ? palette.medalBronze
      : metal === "silver"
        ? palette.medalSilver
        : palette.medalGold;

  const toss = useSharedValue(reduceMotion ? 1 : 0);
  const settle = useSharedValue(1);
  const burst = useSharedValue(reduceMotion ? 1 : 0);
  const glint = useSharedValue(reduceMotion ? 1 : 0);
  const confetti = useSharedValue(reduceMotion ? 1 : 0);
  const glow = useSharedValue(reduceMotion ? 1 : 0);
  const pip0 = useSharedValue(reduceMotion ? 1 : 0);
  const pip1 = useSharedValue(reduceMotion ? 1 : 0);
  const pip2 = useSharedValue(reduceMotion ? 1 : 0);
  const pip3 = useSharedValue(reduceMotion ? 1 : 0);
  const pip4 = useSharedValue(reduceMotion ? 1 : 0);
  const pip5 = useSharedValue(reduceMotion ? 1 : 0);
  const pips = [pip0, pip1, pip2, pip3, pip4, pip5];
  const pipCount = Math.min(pips.length, totalLevels);

  useEffect(() => {
    if (reduceMotion) return;
    const land = MEDAL_LAND_MS;
    // Three and a half turns, slowing as it comes up, so it lands face on.
    toss.value = withTiming(1, { duration: land, easing: Easing.out(Easing.cubic) });
    settle.value = withDelay(
      land,
      withSequence(
        withTiming(1.1, { duration: 90, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 8, stiffness: 220, mass: 0.7 }),
      ),
    );
    burst.value = withDelay(
      land,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );
    glow.value = withDelay(land - 120, withTiming(1, { duration: 500 }));
    // One glint as it lands, then two more while the card is open.
    glint.value = withDelay(
      land + 120,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }),
          withDelay(1800, withTiming(0, { duration: 0 })),
        ),
        3,
        false,
      ),
    );
    if (top) {
      confetti.value = withDelay(land, withTiming(1, { duration: 1600, easing: Easing.linear }));
    }
    const firstPip = land + 260;
    pips.forEach((value, index) => {
      if (index >= pipCount) return;
      value.value = withDelay(
        firstPip + index * PIP_STEP_MS,
        withSequence(
          withTiming(index === level - 1 ? 1.6 : 1.25, {
            duration: 130,
            easing: Easing.out(Easing.back(2)),
          }),
          withSpring(1, { damping: 9, stiffness: 240 }),
        ),
      );
    });

    const timers = [
      // A light tick on each half turn, then a firm one as it lands.
      ...[0.18, 0.4, 0.62].map((at) =>
        setTimeout(() => void Haptics.selectionAsync(), Math.round(land * at)),
      ),
      setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), land),
      ...Array.from({ length: Math.min(level, pipCount) }, (_, index) =>
        setTimeout(() => void Haptics.selectionAsync(), firstPip + index * PIP_STEP_MS + 60),
      ),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const medalStyle = useAnimatedStyle(() => {
    const t = toss.value;
    // Up from below the card, growing, spinning round its vertical axis.
    const arc = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 26;
    return {
      opacity: Math.min(1, t * 5),
      transform: [
        { perspective: 700 },
        { translateY: 70 * (1 - t) * (1 - t) - arc * (1 - t) },
        { scale: (0.35 + 0.65 * t) * settle.value },
        { rotateY: `${1260 * (1 - t)}deg` },
      ],
    };
  });
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.32 * glow.value,
    transform: [{ scale: 0.6 + 0.5 * glow.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: burst.value <= 0 || burst.value >= 1 ? 0 : 0.7 * (1 - burst.value),
    transform: [{ scale: 0.8 + 0.9 * burst.value }],
  }));
  const glintStyle = useAnimatedStyle(() => ({
    opacity: glint.value <= 0 || glint.value >= 1 ? 0 : 0.55,
    transform: [{ translateX: -60 + 130 * glint.value }, { rotate: "22deg" }],
  }));

  // The medal's face is the circle r36 at (60, 54) in its 120 box.
  const faceRadius = (36 / 120) * MEDAL_SIZE;
  const faceLeft = (60 / 120) * MEDAL_SIZE - faceRadius;
  const faceTop = (54 / 120) * MEDAL_SIZE - faceRadius;
  const confettiColors = [
    palette.medalGold,
    palette.orange,
    palette.success,
    palette.saved,
    palette.teal,
    palette.passportGold,
  ];

  return (
    <>
      <View testID="medal-reveal" style={styles.art}>
        <Animated.View
          pointerEvents="none"
          style={[glowStyle, styles.glow, { backgroundColor: glowColor, borderRadius: radii.pill }]}
        />
        {reduceMotion ? null : (
          <>
            <Animated.View
              pointerEvents="none"
              style={[
                ringStyle,
                styles.inkRing,
                { borderColor: glowColor, borderRadius: radii.pill },
              ]}
            />
            {Array.from({ length: MEDAL_RAYS }, (_, index) => (
              <MedalRay key={index} index={index} progress={burst} color={glowColor} />
            ))}
            {top
              ? Array.from({ length: CONFETTI_PIECES }, (_, index) => (
                  <ConfettiPiece
                    key={index}
                    index={index}
                    progress={confetti}
                    color={confettiColors[index % confettiColors.length]!}
                  />
                ))
              : null}
          </>
        )}
        <Animated.View style={reduceMotion ? undefined : medalStyle}>
          <AchievementBadgeArt
            icon={unlock.icon}
            level={level}
            totalLevels={totalLevels}
            size={MEDAL_SIZE}
          />
          {reduceMotion ? null : (
            <View
              pointerEvents="none"
              style={{
                borderRadius: faceRadius,
                height: faceRadius * 2,
                left: faceLeft,
                overflow: "hidden",
                position: "absolute",
                top: faceTop,
                width: faceRadius * 2,
              }}
            >
              <Animated.View
                style={[glintStyle, styles.glint, { backgroundColor: palette.white }]}
              />
            </View>
          )}
        </Animated.View>
      </View>
      <View
        accessible
        accessibilityLabel={`Level ${level} of ${totalLevels}`}
        style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}
      >
        {Array.from({ length: pipCount }, (_, index) => {
          const pipMetal = medalMetal(index + 1, totalLevels);
          const color =
            pipMetal === "bronze"
              ? palette.medalBronze
              : pipMetal === "silver"
                ? palette.medalSilver
                : palette.medalGold;
          return (
            <LevelPip
              key={index}
              progress={pips[index]!}
              earned={index < level}
              color={color}
              emptyColor={palette.border}
            />
          );
        })}
      </View>
    </>
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

/** One short ray of light thrown out as the medal lands. */
function MedalRay({
  index,
  progress,
  color,
}: {
  index: number;
  progress: SharedValue<number>;
  color: string;
}) {
  const angle = (360 * index) / MEDAL_RAYS;
  const length = index % 2 === 0 ? 16 : 10;
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: t <= 0 || t >= 1 ? 0 : 1 - t,
      transform: [
        { rotate: `${angle}deg` },
        { translateY: -(52 + 26 * t) },
        { scaleY: 1 - 0.6 * t },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        { backgroundColor: color, borderRadius: 2, height: length, position: "absolute", width: 3 },
      ]}
    />
  );
}

/** One piece of confetti for the last level: thrown up, then falling and turning. */
function ConfettiPiece({
  index,
  progress,
  color,
}: {
  index: number;
  progress: SharedValue<number>;
  color: string;
}) {
  const spread = (index / (CONFETTI_PIECES - 1) - 0.5) * 2;
  const throwX = spread * (90 + (index % 4) * 18);
  const throwUp = 110 + (index % 5) * 16;
  const turn = (index % 2 === 0 ? 1 : -1) * (360 + (index % 3) * 180);
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: t <= 0 || t >= 1 ? 0 : t > 0.7 ? (1 - t) / 0.3 : 1,
      transform: [
        { translateX: throwX * t },
        { translateY: -throwUp * t + 300 * t * t },
        { rotate: `${turn * t}deg` },
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
          borderRadius: 1.5,
          height: index % 3 === 0 ? 6 : 10,
          position: "absolute",
          width: 6,
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

/** One level of an achievement, in the metal of that level. */
function LevelPip({
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
    <Animated.View
      style={[
        style,
        styles.pip,
        earned
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: "transparent", borderColor: emptyColor },
      ]}
    />
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
  glint: { height: 120, left: 0, position: "absolute", top: -20, width: 16 },
  glow: { height: 120, position: "absolute", width: 120 },
  goalDisc: { alignItems: "center", height: 88, justifyContent: "center", width: 88 },
  imprint: { borderRadius: 60, height: 112, position: "absolute", width: 112 },
  inkRing: { borderWidth: 3, height: 120, position: "absolute", width: 120 },
  pip: { borderRadius: 6, borderWidth: 1.5, height: 12, width: 12 },
  shadow: { borderRadius: 60, bottom: 4, height: 16, opacity: 0, position: "absolute", width: 96 },
});
