import { useLayoutEffect, useState } from "react";
import { Animated, Easing, View, type ViewStyle } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { useReduceMotion } from "@/hooks/useReduceMotion";

/** How far the old and new values travel sideways while they swap, in points. */
export const SLIDE_TEXT_TRAVEL = 20;
export const SLIDE_TEXT_DURATION_MS = 240;

type TextProps = Omit<React.ComponentProps<typeof AppText>, "children">;

type Props = TextProps & {
  /** The text to show. When it changes, the old value slides out left and the new one in from the right. */
  value: string;
  /** Layout for the clipping box around the text (for example `flexShrink: 1` in a row). */
  containerStyle?: ViewStyle;
};

/**
 * A number or short label that changes while it is on screen (the stall count, the place name).
 * The first value just appears; each later change slides sideways instead of jumping. Under Reduce
 * Motion the value is swapped at once. Screen readers only ever see the current value.
 */
export function SlideText({ value, containerStyle, ...textProps }: Props) {
  const reduceMotion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(1));
  const [state, setState] = useState<{ current: string; previous: string | null }>({
    current: value,
    previous: null,
  });

  // Take the new value in the same render, so it is never shown without its slide-in.
  if (state.current !== value) {
    setState({ current: value, previous: reduceMotion ? null : state.current });
  }

  useLayoutEffect(() => {
    if (state.previous === null) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: SLIDE_TEXT_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) setState((s) => (s.current === state.current ? { ...s, previous: null } : s));
    });
    return () => animation.stop();
  }, [progress, state.current, state.previous]);

  const enter = {
    opacity: progress,
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [SLIDE_TEXT_TRAVEL, 0],
        }),
      },
    ],
  };
  const leave = {
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -SLIDE_TEXT_TRAVEL],
        }),
      },
    ],
  };

  return (
    <View style={[{ overflow: "hidden" }, containerStyle]}>
      <Animated.View style={state.previous === null ? undefined : enter}>
        <AppText {...textProps}>{state.current}</AppText>
      </Animated.View>
      {state.previous === null ? null : (
        <Animated.View
          accessibilityElementsHidden
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[{ left: 0, position: "absolute", right: 0, top: 0 }, leave]}
        >
          <AppText {...textProps}>{state.previous}</AppText>
        </Animated.View>
      )}
    </View>
  );
}
