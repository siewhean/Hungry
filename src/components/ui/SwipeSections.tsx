import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { useSwipeResponder } from "@/features/navigation/useSwipeResponder";
import { selectHaptic } from "@/lib/haptics";

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
 * that starts at a screen edge is left alone: that one moves between pages, and on a pushed
 * screen the left edge is the system's back swipe (no gesture handler sits over this page, so the
 * system swipe is never blocked). Vertical scrolling inside is untouched: the swipe only takes
 * over once the finger has moved sideways first.
 */
export function SwipeSections({ onSwipeLeft, onSwipeRight, children, style }: Props) {
  const panHandlers = useSwipeResponder("content", (intent) => {
    if (intent === "content-left" && onSwipeLeft) {
      selectHaptic();
      onSwipeLeft();
    } else if (intent === "content-right" && onSwipeRight) {
      selectHaptic();
      onSwipeRight();
    }
  });
  const enabled = Boolean(onSwipeLeft || onSwipeRight);

  return (
    <View style={[{ flex: 1 }, style]} {...(enabled ? panHandlers : {})}>
      {children}
    </View>
  );
}
