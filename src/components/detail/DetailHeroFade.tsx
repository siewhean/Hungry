import type { ReactNode } from "react";
import { Animated } from "react-native";

type Props = {
  /** The page's vertical scroll offset. */
  scrollY: Animated.Value;
  height: number;
  children?: ReactNode;
};

/**
 * Holds the photo at the top of the dish and stall pages and fades it out as the page
 * scrolls up, so the content slides over a clean background.
 */
export function DetailHeroFade({ scrollY, height, children }: Props) {
  const opacity = scrollY.interpolate({
    inputRange: [0, Math.max(1, height * 0.85)],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  return <Animated.View style={{ height, opacity }}>{children}</Animated.View>;
}
