import type { ReactNode } from "react";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

type Props = {
  /** The page's vertical scroll offset, written on the UI thread by the page's scroll handler. */
  scrollY: SharedValue<number>;
  height: number;
  children?: ReactNode;
};

/**
 * Holds the photo at the top of the dish and stall pages and fades it out as the page
 * scrolls up, so the content slides over a clean background. The fade runs on the UI thread.
 */
export function DetailHeroFade({ scrollY, height, children }: Props) {
  const end = Math.max(1, height * 0.85);
  const fade = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, end], [1, 0], Extrapolation.CLAMP),
  }));
  return <Animated.View style={[{ height }, fade]}>{children}</Animated.View>;
}
