import { useEffect } from "react";
import { Platform } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useHungryTheme } from "@/theme";
import { HomeWaterShader } from "./HomeWaterShader";

/** How far the page scrolls before the waves have faded into the normal background. */
export const WAVE_FADE_DISTANCE = 180;
/** Height of the wavy band below the status bar. */
export const WAVE_BAND_HEIGHT = 240;
/** One full drift of the waves. */
export const WAVE_LOOP_MS = 9000;

/** Seconds the water clock is wound forward each time it starts (an hour of motion). */
const WATER_CLOCK_SECONDS = 3600;
/**
 * The water shader runs on the phone through Skia (Metal on iPhone). The web build, where Skia
 * needs its own wasm, keeps the plain drifting waves below.
 */
const USE_WATER_SHADER = Platform.OS !== "web";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const STEPS = 28;

/**
 * The outline of a band hanging from the top of the screen whose lower edge is a sine wave:
 * `baseY` is the middle of the wave, `amplitude` how tall it is, `cycles` how many humps fit across
 * the width, and `phase` (radians) slides it sideways. Runs on the UI thread.
 */
export function waveBandPath(
  width: number,
  baseY: number,
  amplitude: number,
  cycles: number,
  phase: number,
): string {
  "worklet";
  let d = `M0 0 L${width} 0`;
  for (let step = STEPS; step >= 0; step -= 1) {
    const x = (width * step) / STEPS;
    const y = baseY + amplitude * Math.sin((x / width) * cycles * 2 * Math.PI + phase);
    d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d} Z`;
}

type Props = {
  width: number;
  /** Safe-area top, so the band reaches behind the status bar. */
  topInset: number;
  /** The page's vertical scroll offset; the waves fade out as it grows. */
  scrollY: SharedValue<number>;
  /** False while Home is not on screen: the drift stops and costs nothing. */
  active?: boolean;
};

/**
 * Two soft waves of the theme orange drifting across the top of Home. They stay pinned to the top of the screen
 * while the page scrolls and fade into the normal background as it does. They never take touches,
 * are hidden from screen readers, and hold still under Reduce Motion.
 */
export function HomeWaveBackground({ width, topInset, scrollY, active = true }: Props) {
  const { palette, colorScheme } = useHungryTheme();
  const isDark = colorScheme === "dark";
  const reduceMotion = useReduceMotion();
  const phase = useSharedValue(0);
  // Seconds on the water shader's clock; a still frame under Reduce Motion.
  const time = useSharedValue(2);

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(phase);
      cancelAnimation(time);
      return;
    }
    time.value = withTiming(time.value + WATER_CLOCK_SECONDS, {
      duration: WATER_CLOCK_SECONDS * 1000,
      easing: Easing.linear,
    });
    phase.value = withRepeat(
      withTiming(2 * Math.PI, { duration: WAVE_LOOP_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(phase);
      cancelAnimation(time);
    };
  }, [active, phase, reduceMotion, time]);

  const height = topInset + WAVE_BAND_HEIGHT;
  const backProps = useAnimatedProps(() => ({
    d: waveBandPath(width, height - 34, 16, 1.25, phase.value),
  }));
  const frontProps = useAnimatedProps(() => ({
    d: waveBandPath(width, height - 52, 12, 2, -phase.value * 2 + 1),
  }));
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, WAVE_FADE_DISTANCE], [1, 0], "clamp"),
  }));

  return (
    <Animated.View
      testID="home-wave-background"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ height, left: 0, position: "absolute", right: 0, top: -topInset }, fadeStyle]}
    >
      {USE_WATER_SHADER ? (
        <HomeWaterShader
          width={width}
          height={height}
          time={time}
          color={palette.orange}
          strength={isDark ? 0.4 : 0.46}
        />
      ) : (
        <Svg width={width} height={height}>
          <AnimatedPath animatedProps={backProps} fill={palette.orange} fillOpacity={0.14} />
          <AnimatedPath animatedProps={frontProps} fill={palette.orange} fillOpacity={0.2} />
        </Svg>
      )}
    </Animated.View>
  );
}
