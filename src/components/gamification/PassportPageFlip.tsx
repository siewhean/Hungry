import type { PropsWithChildren } from "react";

import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

interface PassportPageFlipProps {
  pageKey: string | number;
  reduceMotion?: boolean;
}

export function PassportPageFlip({
  children,
  pageKey,
  reduceMotion = false,
}: PropsWithChildren<PassportPageFlipProps>) {
  const turn = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      turn.value = 1;
      return;
    }
    turn.value = 0;
    turn.value = withTiming(1, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
  }, [pageKey, reduceMotion, turn]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 : interpolate(turn.value, [0, 0.18, 1], [0.86, 1, 1]),
    transform: reduceMotion
      ? []
      : [
          { perspective: 900 },
          { rotateY: `${interpolate(turn.value, [0, 1], [-7, 0])}deg` },
          { scale: interpolate(turn.value, [0, 1], [0.985, 1]) },
        ],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}
