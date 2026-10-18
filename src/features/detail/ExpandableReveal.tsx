import { useEffect, useState, type ReactNode } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useReduceMotion } from "@/hooks/useReduceMotion";

const OPEN_DURATION_MS = 280;
const CLOSE_DURATION_MS = 220;
const DROP_DISTANCE = 12;

type ExpandableRevealProps = {
  open: boolean;
  children: ReactNode;
};

/**
 * Drops its children down when `open` becomes true and folds them back up when it
 * becomes false (height + opacity + translateY). Content is measured off-flow so the
 * animated height matches its natural size; it unmounts once fully closed.
 * Reduce Motion (system or in-app) skips the animation entirely.
 */
export function ExpandableReveal({ open, children }: ExpandableRevealProps) {
  const reduceMotion = useReduceMotion();
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(open ? 1 : 0);
  const contentHeight = useSharedValue(0);

  useEffect(() => {
    if (open) setMounted(true);

    if (reduceMotion) {
      progress.value = open ? 1 : 0;
      if (!open) setMounted(false);
      return;
    }

    progress.value = withTiming(
      open ? 1 : 0,
      {
        duration: open ? OPEN_DURATION_MS : CLOSE_DURATION_MS,
        easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished && !open) runOnJS(setMounted)(false);
      },
    );
  }, [open, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: contentHeight.value * progress.value,
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -DROP_DISTANCE }],
  }));

  const handleContentLayout = (event: LayoutChangeEvent) => {
    contentHeight.value = event.nativeEvent.layout.height;
  };

  if (!mounted) return null;

  return (
    <Animated.View style={[{ overflow: "hidden" }, animatedStyle]}>
      <View
        onLayout={handleContentLayout}
        style={{ left: 0, position: "absolute", right: 0, top: 0 }}
      >
        {children}
      </View>
    </Animated.View>
  );
}
