import type { PropsWithChildren } from "react";

import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

import { useReduceMotion } from "@/hooks/useReduceMotion";

interface PassportPageFlipProps {
  pageKey: string | number;
  reduceMotion?: boolean;
}

export function PassportPageFlip({
  children,
  pageKey,
  reduceMotion = false,
}: PropsWithChildren<PassportPageFlipProps>) {
  const prefersReducedMotion = useReduceMotion();
  const shouldReduceMotion = reduceMotion || prefersReducedMotion;
  const turn = useSharedValue(1);

  useEffect(() => {
    if (shouldReduceMotion) {
      turn.value = 1;
      return;
    }
    turn.value = 0;
    turn.value = withTiming(1, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
  }, [pageKey, shouldReduceMotion, turn]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: shouldReduceMotion ? 1 : interpolate(turn.value, [0, 0.18, 1], [0.86, 1, 1]),
    transform: shouldReduceMotion
      ? []
      : [
          { perspective: 900 },
          { rotateY: `${interpolate(turn.value, [0, 1], [-7, 0])}deg` },
          { scale: interpolate(turn.value, [0, 1], [0.985, 1]) },
        ],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}
