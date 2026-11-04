// Shared motion for small UI moments, on the UI thread (Reanimated). Strong ease-out so a
// response starts at once; nothing here is used for things people do dozens of times a minute.
import { useEffect } from "react";
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/** Press feedback: the control scales down while held and returns on release. */
export const PRESS_SCALE = 0.97;
export const PRESS_MS = 120;

/**
 * Scale-on-press for a control. Spread `onPressIn`/`onPressOut` onto the Pressable and the
 * returned style onto the animated view. Skipped under Reduce Motion.
 */
export function usePressScale(reduceMotion: boolean, scaleTo: number = PRESS_SCALE) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return {
    animatedStyle,
    onPressIn: () => {
      if (!reduceMotion) scale.set(withTiming(scaleTo, { duration: PRESS_MS, easing: EASE_OUT }));
    },
    onPressOut: () => {
      scale.set(withTiming(1, { duration: PRESS_MS, easing: EASE_OUT }));
    },
  };
}

/** A rise-and-fade entrance on mount. Shows at once (no motion) under Reduce Motion. */
export function useRiseIn(
  reduceMotion: boolean,
  {
    delay = 0,
    duration = 250,
    distance = 8,
  }: { delay?: number; duration?: number; distance?: number } = {},
) {
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      progress.set(1);
      return;
    }
    progress.set(withDelay(delay, withTiming(1, { duration, easing: EASE_OUT })));
  }, [delay, duration, progress, reduceMotion]);
  return useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * distance }],
  }));
}

/** Delay for the nth item of a staggered entrance; the tail is capped so long lists don't drag. */
export function staggerDelay(index: number, stepMs = 40, maxItems = 6): number {
  return Math.min(index, maxItems) * stepMs;
}

/** A small mark that appears (check badge): scales from 0.9 while fading in, 150 ms. */
export function useScaleIn(reduceMotion: boolean) {
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    progress.set(reduceMotion ? 1 : withTiming(1, { duration: 150, easing: EASE_OUT }));
  }, [progress, reduceMotion]);
  return useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: 0.9 + progress.get() * 0.1 }],
  }));
}

/** Shared by step changes and screen entrances; see useFadeRiseIn. */
export const STEP_MS = 200;
export const REDUCED_FADE_MS = 150;

/**
 * A fade-and-rise entrance for a step or screen, on mount. Under Reduce Motion the slide goes
 * and a short opacity fade stays: reduced motion means gentler, not none.
 */
export function useFadeRiseIn(
  reduceMotion: boolean,
  {
    duration = STEP_MS,
    distance = 8,
    resetKey,
  }: { duration?: number; distance?: number; resetKey?: unknown } = {},
) {
  const progress = useSharedValue(0);
  // A changed `resetKey` plays the entrance again (a tab switch on the same screen).
  useEffect(() => {
    progress.set(0);
    progress.set(
      withTiming(1, { duration: reduceMotion ? REDUCED_FADE_MS : duration, easing: EASE_OUT }),
    );
  }, [duration, progress, reduceMotion, resetKey]);
  return useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.get()) * distance }],
  }));
}
