import { useMemo, useRef, type ReactNode } from "react";
import { PanResponder, Pressable, View } from "react-native";
import Animated, {
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { AppSymbol, AppText } from "@/components/ui";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { EASE_OUT } from "@/lib/motion/uiMotion";
import { useHungryTheme } from "@/theme";

/** How far the row slides to show its Remove button. */
export const SWIPE_ACTION_WIDTH = 96;
/** A drag past this snaps open; less snaps shut. */
const SWIPE_OPEN_THRESHOLD = 48;

type Props = {
  children: ReactNode;
  /** Names the row for the Remove button and the screen-reader action. */
  label: string;
  /** False hides the swipe (e.g. the Tried tab, where nothing is removed). */
  enabled?: boolean;
  removing?: boolean;
  onRemove: () => void;
};

/**
 * A list row that slides left to show Remove (the iOS swipe action). The same removal is also a
 * named screen-reader action, so it never depends on the gesture. When the row leaves the list
 * it fades out and the rows below close the gap over 200ms (a plain cut under Reduce Motion).
 */
export function SwipeToRemove({
  children,
  label,
  enabled = true,
  removing = false,
  onRemove,
}: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const reduceMotion = useReduceMotion();
  const offset = useSharedValue(0);
  const opened = useRef(false);

  const moveTo = (value: number) => {
    offset.set(reduceMotion ? value : withTiming(value, { duration: 200, easing: EASE_OUT }));
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Only a mostly-horizontal drag takes over, so vertical scrolling is untouched.
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
        onPanResponderMove: (_event, gesture) => {
          const base = opened.current ? -SWIPE_ACTION_WIDTH : 0;
          offset.set(Math.min(0, Math.max(-SWIPE_ACTION_WIDTH * 1.2, base + gesture.dx)));
        },
        onPanResponderRelease: (_event, gesture) => {
          const base = opened.current ? -SWIPE_ACTION_WIDTH : 0;
          const end = base + gesture.dx;
          opened.current = end < -SWIPE_OPEN_THRESHOLD;
          moveTo(opened.current ? -SWIPE_ACTION_WIDTH : 0);
        },
        onPanResponderTerminate: () => moveTo(opened.current ? -SWIPE_ACTION_WIDTH : 0),
      }),
    // moveTo reads reduceMotion; offset is stable.

    [reduceMotion],
  );

  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
  const motion = reduceMotion
    ? {}
    : { exiting: FadeOut.duration(200), layout: LinearTransition.duration(200) };

  if (!enabled) return <Animated.View {...motion}>{children}</Animated.View>;

  return (
    <Animated.View
      {...motion}
      testID="swipe-to-remove"
      accessibilityActions={[{ name: "remove", label: `Remove ${label} from Saved` }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "remove") onRemove();
      }}
      style={{ overflow: "hidden", borderRadius: componentRadii.card }}
    >
      <View
        style={{
          alignItems: "flex-end",
          backgroundColor: palette.error,
          borderRadius: componentRadii.card,
          bottom: 0,
          justifyContent: "center",
          position: "absolute",
          right: 0,
          top: 0,
          width: SWIPE_ACTION_WIDTH + 24,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label} from Saved`}
          disabled={removing}
          onPress={() => {
            opened.current = false;
            moveTo(0);
            onRemove();
          }}
          style={{
            alignItems: "center",
            gap: spacing[1],
            height: "100%",
            justifyContent: "center",
            width: SWIPE_ACTION_WIDTH,
          }}
        >
          <AppSymbol name="trash" color={palette.textOnOrange} size={20} />
          <AppText variant="bodySmallBold" style={{ color: palette.textOnOrange }}>
            Remove
          </AppText>
        </Pressable>
      </View>
      <Animated.View {...responder.panHandlers} style={slideStyle}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}
