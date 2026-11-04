import { useMemo, useState, type ReactNode } from "react";
import { Animated, Easing, PanResponder, useWindowDimensions } from "react-native";

import { useReduceMotion } from "@/hooks/useReduceMotion";
import { selectHaptic } from "@/lib/haptics";

import { swipeAwayDirection } from "./swipeAway";

type Props = {
  /** Called once the banner has left the screen (or at once under Reduce Motion). */
  onDismiss: () => void;
  children: ReactNode;
};

const EXIT_MS = 180;

/**
 * Lets a banner or toast be swiped away: drag it up, left or right and let go. It follows the
 * finger, springs back if the drag was short, and slides off the screen if it was long or quick.
 * Taps on what is inside still work, because a drag only starts after a few points of movement.
 */
export function SwipeAwayView({ onDismiss, children }: Props) {
  const reduceMotion = useReduceMotion();
  const { width } = useWindowDimensions();
  const [offset] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const [fade] = useState(() => new Animated.Value(1));

  const responder = useMemo(() => {
    const springBack = () => {
      Animated.parallel([
        Animated.spring(offset, { toValue: { x: 0, y: 0 }, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 8 || gesture.dy < -8,
      onPanResponderMove: (_event, gesture) => {
        // Never dragged downwards: only the three ways out follow the finger.
        offset.setValue({ x: gesture.dx, y: Math.min(0, gesture.dy) });
        fade.setValue(Math.max(0.4, 1 - Math.hypot(gesture.dx, gesture.dy) / (width * 0.8)));
      },
      onPanResponderRelease: (_event, gesture) => {
        const direction = swipeAwayDirection(gesture);
        if (direction === null) {
          springBack();
          return;
        }
        selectHaptic();
        if (reduceMotion) {
          onDismiss();
          return;
        }
        Animated.parallel([
          Animated.timing(offset, {
            toValue:
              direction === "up"
                ? { x: 0, y: -240 }
                : { x: direction === "left" ? -width : width, y: 0 },
            duration: EXIT_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(fade, { toValue: 0, duration: EXIT_MS, useNativeDriver: true }),
        ]).start(({ finished }) => {
          if (finished) onDismiss();
        });
      },
      onPanResponderTerminate: springBack,
    });
  }, [fade, offset, onDismiss, reduceMotion, width]);

  return (
    <Animated.View
      {...responder.panHandlers}
      style={{
        opacity: fade,
        transform: [{ translateX: offset.x }, { translateY: offset.y }],
      }}
    >
      {children}
    </Animated.View>
  );
}
