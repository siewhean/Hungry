import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
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
  const startX = useSharedValue(0);

  const moveTo = (value: number) => {
    offset.set(reduceMotion ? value : withTiming(value, { duration: 200, easing: EASE_OUT }));
  };

  // The drag runs on the UI thread, so it stays smooth while the list re-renders. Only a mostly
  // horizontal drag takes over (a vertical one fails the gesture), so scrolling is untouched.
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onStart(() => {
      startX.set(offset.get());
    })
    .onUpdate((event) => {
      offset.set(
        Math.min(0, Math.max(-SWIPE_ACTION_WIDTH * 1.2, startX.get() + event.translationX)),
      );
    })
    .onEnd((event) => {
      const open = startX.get() + event.translationX < -SWIPE_OPEN_THRESHOLD;
      const target = open ? -SWIPE_ACTION_WIDTH : 0;
      offset.set(reduceMotion ? target : withTiming(target, { duration: 200, easing: EASE_OUT }));
    });

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
      {/* Hidden from screen readers: the row has its own Remove button and a Remove action. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
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
      <GestureDetector gesture={pan}>
        <Animated.View style={slideStyle}>{children}</Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}
