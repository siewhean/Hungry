import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useHungryTheme } from "@/theme";
import { AppSymbol } from "./AppSymbol";

const PARTICLE_COUNT = 16;
const BURST_MS = 900;
const BADGE_SIZE = 64;

function Particle({
  angle,
  distance,
  color,
  size,
  delay,
}: {
  angle: number;
  distance: number;
  color: string;
  size: number;
  delay: number;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(
      withDelay(delay, withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.cubic) })),
    );
  }, [delay, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.get() === 0 ? 0 : 1 - progress.get() * progress.get(),
    transform: [
      { translateX: Math.cos(angle) * distance * progress.get() },
      { translateY: Math.sin(angle) * distance * progress.get() + progress.get() * 14 },
      { rotate: `${progress.get() * 220}deg` },
      { scale: 1 - progress.get() * 0.35 },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size * 1.6,
          borderRadius: size / 3,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

/**
 * A check badge that pops in with a burst of confetti around it. Shows the badge still, with no
 * confetti, under Reduce Motion. Decorative: the message beside it carries the meaning.
 */
export function CelebrationBurst({ testID }: { testID?: string }) {
  const { palette } = useHungryTheme();
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      scale.set(1);
      return;
    }
    scale.set(
      withSequence(
        withTiming(1.18, { duration: 180, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      ),
    );
  }, [reduceMotion, scale]);
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const particles = useMemo(() => {
    const colors = [palette.orange, palette.starFill, palette.success, palette.orangeLight];
    return Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
      key: index,
      angle: (index / PARTICLE_COUNT) * Math.PI * 2 + (index % 2 ? 0.12 : -0.12),
      distance: 62 + (index % 3) * 22,
      color: colors[index % colors.length],
      size: 6 + (index % 3) * 2,
      delay: (index % 4) * 30,
    }));
  }, [palette.orange, palette.orangeLight, palette.starFill, palette.success]);

  return (
    <View
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ alignItems: "center", height: 150, justifyContent: "center" }}
    >
      {reduceMotion
        ? null
        : particles.map(({ key, ...props }) => <Particle key={key} {...props} />)}
      <Animated.View
        style={[
          {
            alignItems: "center",
            backgroundColor: palette.success,
            borderRadius: BADGE_SIZE / 2,
            height: BADGE_SIZE,
            justifyContent: "center",
            width: BADGE_SIZE,
          },
          badgeStyle,
        ]}
      >
        <AppSymbol name="selected" size={32} color={palette.white} />
      </Animated.View>
    </View>
  );
}
