import { useRef, type ReactNode } from "react";
import { View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { selectHaptic } from "@/lib/haptics";
import { EDGE_SWIPE_ZONE, classifySwipe } from "@/features/navigation/swipeIntent";

const ACTIVATE_DISTANCE = 14;

type Props = {
  /** A swipe to the left inside the page (the next section). */
  onSwipeLeft?: () => void;
  /** A swipe to the right inside the page (the previous section). */
  onSwipeRight?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Lets a sideways swipe over the content change section (Dishes / Stalls, All / For you). A swipe
 * that starts at a screen edge is left alone: that one moves between pages. Vertical scrolling
 * inside is untouched: the swipe only starts once the finger has moved sideways first.
 */
export function SwipeSections({ onSwipeLeft, onSwipeRight, children, style }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const handlers = useRef({ onSwipeLeft, onSwipeRight });
  handlers.current = { onSwipeLeft, onSwipeRight };

  // Manual activation: a touch that starts in an edge band fails at once, so the page-edge swipe
  // (EdgeSwipeZones) is the only gesture that can take it; elsewhere this takes over once the
  // finger has moved sideways, and gives way to vertical scrolling.
  const start = useRef({ x: 0, y: 0 });
  const pan = Gesture.Pan()
    .runOnJS(true)
    .manualActivation(true)
    .onTouchesDown((event, manager) => {
      const touch = event.allTouches[0];
      if (!touch) return;
      start.current = { x: touch.absoluteX, y: touch.absoluteY };
      const inEdgeBand =
        touch.absoluteX <= EDGE_SWIPE_ZONE || touch.absoluteX >= screenWidth - EDGE_SWIPE_ZONE;
      if (inEdgeBand) manager.fail();
    })
    .onTouchesMove((event, manager) => {
      const touch = event.allTouches[0];
      if (!touch) return;
      const dx = touch.absoluteX - start.current.x;
      const dy = touch.absoluteY - start.current.y;
      if (Math.abs(dy) > ACTIVATE_DISTANCE && Math.abs(dy) > Math.abs(dx)) manager.fail();
      else if (Math.abs(dx) > ACTIVATE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
        manager.activate();
      }
    })
    .onEnd((event) => {
      const intent = classifySwipe({
        startX: start.current.x,
        translationX: event.translationX,
        translationY: event.translationY,
        velocityX: event.velocityX,
        screenWidth,
      });
      if (intent === "content-left" && handlers.current.onSwipeLeft) {
        selectHaptic();
        handlers.current.onSwipeLeft();
      } else if (intent === "content-right" && handlers.current.onSwipeRight) {
        selectHaptic();
        handlers.current.onSwipeRight();
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={[{ flex: 1 }, style]}>{children}</View>
    </GestureDetector>
  );
}
