import { useRef, type ReactNode } from "react";
import { View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { EDGE_SWIPE_ZONE, classifySwipe } from "@/features/navigation/swipeIntent";
import { selectHaptic } from "@/lib/haptics";

type Props = {
  /** A swipe that starts at the left edge and moves right (the previous page). */
  onSwipeFromLeft?: () => void;
  /** A swipe that starts at the right edge and moves left (the next page). */
  onSwipeFromRight?: () => void;
  children: ReactNode;
};

/** Sideways travel (pt) before the swipe takes over, and the up/down drift that cancels it. */
const ACTIVATE_DISTANCE = 12;
const CANCEL_DRIFT = 24;

/**
 * A swipe that starts in the thin band down either screen edge moves to the next or previous page.
 * Touches that start anywhere else are ignored (the gesture fails at once), so the rest of the page
 * keeps its taps, scrolling and its own swipes (carousels, Dishes / Stalls, All / For you), and a
 * tap near the edge still reaches the card under it.
 */
export function EdgeSwipeZones({ onSwipeFromLeft, onSwipeFromRight, children }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const start = useRef({ x: 0, y: 0 });
  const handlers = useRef({ onSwipeFromLeft, onSwipeFromRight });
  handlers.current = { onSwipeFromLeft, onSwipeFromRight };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .manualActivation(true)
    .enabled(Boolean(onSwipeFromLeft || onSwipeFromRight))
    .onTouchesDown((event, manager) => {
      const touch = event.allTouches[0];
      if (!touch) return;
      start.current = { x: touch.absoluteX, y: touch.absoluteY };
      const inEdgeBand =
        touch.absoluteX <= EDGE_SWIPE_ZONE || touch.absoluteX >= screenWidth - EDGE_SWIPE_ZONE;
      if (!inEdgeBand) manager.fail();
    })
    .onTouchesMove((event, manager) => {
      const touch = event.allTouches[0];
      if (!touch) return;
      const dx = touch.absoluteX - start.current.x;
      const dy = touch.absoluteY - start.current.y;
      if (Math.abs(dy) > CANCEL_DRIFT && Math.abs(dy) > Math.abs(dx)) manager.fail();
      else if (Math.abs(dx) > ACTIVATE_DISTANCE && Math.abs(dx) > Math.abs(dy)) manager.activate();
    })
    .onEnd((event) => {
      const intent = classifySwipe({
        startX: start.current.x,
        translationX: event.translationX,
        translationY: event.translationY,
        velocityX: event.velocityX,
        screenWidth,
      });
      if (intent === "edge-from-left" && handlers.current.onSwipeFromLeft) {
        selectHaptic();
        handlers.current.onSwipeFromLeft();
      } else if (intent === "edge-from-right" && handlers.current.onSwipeFromRight) {
        selectHaptic();
        handlers.current.onSwipeFromRight();
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
}
