import { useMemo, useRef } from "react";
import { PanResponder, useWindowDimensions, type GestureResponderEvent } from "react-native";

import {
  EDGE_SWIPE_ZONE,
  classifySwipe,
  type SwipeIntent,
} from "@/features/navigation/swipeIntent";

/** Sideways travel (pt) before the swipe takes over the touch. */
export const SWIPE_ACTIVATE_DISTANCE = 12;
/** The sideways move must beat the up/down move by this much, so a scroll never turns into a swipe. */
const ACTIVATE_RATIO = 1.5;

/**
 * "edge": only a swipe that starts in the thin band down a screen edge counts, and it takes the
 * touch before anything underneath. "content": only a swipe that starts elsewhere counts, and
 * whatever sits underneath (a button, a scroll view) gets the first chance at the touch.
 */
export type SwipeMode = "edge" | "content";

/**
 * Sideways swipes through React Native's own touch system, not the gesture handler: no native
 * recognizer sits over the page, so the system's back swipe from the left edge of a pushed
 * screen is left alone, and the swipe works the same on every screen it is used on.
 */
export function useSwipeResponder(mode: SwipeMode, onIntent: (intent: SwipeIntent) => void) {
  const { width } = useWindowDimensions();
  const latest = useRef({ width, onIntent });
  latest.current = { width, onIntent };
  const track = useRef({ startX: 0, startY: 0, x: 0, y: 0, t: 0, prevX: 0, prevT: 0 });

  return useMemo(() => {
    const sample = (event: GestureResponderEvent) => {
      const { pageX, pageY, timestamp } = event.nativeEvent;
      const t = track.current;
      t.prevX = t.x;
      t.prevT = t.t;
      t.x = pageX;
      t.y = pageY;
      t.t = timestamp;
    };
    const shouldTake = (event: GestureResponderEvent) => {
      sample(event);
      const t = track.current;
      const { width: screenWidth } = latest.current;
      const inEdgeBand = t.startX <= EDGE_SWIPE_ZONE || t.startX >= screenWidth - EDGE_SWIPE_ZONE;
      if (mode === "edge" ? !inEdgeBand : inEdgeBand) return false;
      const dx = Math.abs(t.x - t.startX);
      const dy = Math.abs(t.y - t.startY);
      return dx > SWIPE_ACTIVATE_DISTANCE && dx > dy * ACTIVATE_RATIO;
    };
    return PanResponder.create({
      // Notes where the touch began; never claims it.
      onStartShouldSetPanResponderCapture: (event) => {
        const { pageX, pageY, timestamp } = event.nativeEvent;
        track.current = {
          startX: pageX,
          startY: pageY,
          x: pageX,
          y: pageY,
          t: timestamp,
          prevX: pageX,
          prevT: timestamp,
        };
        return false;
      },
      ...(mode === "edge"
        ? { onMoveShouldSetPanResponderCapture: shouldTake }
        : { onMoveShouldSetPanResponder: shouldTake }),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: sample,
      onPanResponderRelease: (event) => {
        sample(event);
        const t = track.current;
        const elapsed = t.t - t.prevT;
        const intent = classifySwipe({
          startX: t.startX,
          translationX: t.x - t.startX,
          translationY: t.y - t.startY,
          velocityX: elapsed > 0 ? ((t.x - t.prevX) / elapsed) * 1000 : 0,
          screenWidth: latest.current.width,
        });
        if (intent) latest.current.onIntent(intent);
      },
    });
  }, [mode]).panHandlers;
}
