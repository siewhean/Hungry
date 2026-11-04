import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useReduceMotion } from "@/hooks/useReduceMotion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const PRESS_SCALE = 0.97;
export const PRESS_DURATION_MS = 120;
// A strong ease-out: the press answers at once and settles.
const PRESS_EASING = Easing.bezier(0.23, 1, 0.32, 1);

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
};

/** A card or tile that shrinks to 0.97 under the finger. With Reduce Motion on it does not move. */
export function PressableScale({ style, onPressIn, onPressOut, disabled, ...props }: Props) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const animateTo = (value: number) => {
    if (reduceMotion) return;
    scale.value = withTiming(value, { duration: PRESS_DURATION_MS, easing: PRESS_EASING });
  };

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event: GestureResponderEvent) => {
        animateTo(PRESS_SCALE);
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        animateTo(1);
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    />
  );
}
