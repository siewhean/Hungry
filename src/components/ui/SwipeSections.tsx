import { useRef, type ReactNode } from "react";
import { View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { selectHaptic } from "@/lib/haptics";
import { classifySwipe } from "@/features/navigation/swipeIntent";

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
  const startX = useRef(0);
  const handlers = useRef({ onSwipeLeft, onSwipeRight });
  handlers.current = { onSwipeLeft, onSwipeRight };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-18, 18])
    .failOffsetY([-14, 14])
    .onBegin((event) => {
      startX.current = event.absoluteX;
    })
    .onEnd((event) => {
      const intent = classifySwipe({
        startX: startX.current,
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
