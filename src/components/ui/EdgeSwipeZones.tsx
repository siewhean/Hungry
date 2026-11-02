import type { ReactNode } from "react";
import { View } from "react-native";

import { useSwipeResponder } from "@/features/navigation/useSwipeResponder";
import { selectHaptic } from "@/lib/haptics";

type Props = {
  /** A swipe that starts at the left edge and moves right (the previous page). */
  onSwipeFromLeft?: () => void;
  /** A swipe that starts at the right edge and moves left (the next page). */
  onSwipeFromRight?: () => void;
  children: ReactNode;
};

/**
 * A swipe that starts in the thin band down either screen edge moves to the next or previous page.
 * Touches that start anywhere else are ignored, so the rest of the page keeps its taps, scrolling
 * and its own swipes (carousels, Dishes / Stalls, All / For you), and a tap near the edge still
 * reaches the card under it.
 */
export function EdgeSwipeZones({ onSwipeFromLeft, onSwipeFromRight, children }: Props) {
  const panHandlers = useSwipeResponder("edge", (intent) => {
    if (intent === "edge-from-left" && onSwipeFromLeft) {
      selectHaptic();
      onSwipeFromLeft();
    } else if (intent === "edge-from-right" && onSwipeFromRight) {
      selectHaptic();
      onSwipeFromRight();
    }
  });
  const enabled = Boolean(onSwipeFromLeft || onSwipeFromRight);

  return (
    <View style={{ flex: 1 }} {...(enabled ? panHandlers : {})}>
      {children}
    </View>
  );
}
