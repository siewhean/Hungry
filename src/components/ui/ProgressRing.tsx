import type { ReactNode } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import Svg, { Circle } from "react-native-svg";

import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useHungryTheme } from "@/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  /** 0 to 1; values outside are clamped. */
  fraction: number;
  size: number;
  strokeWidth?: number;
  /** Ring colour; defaults to the brand orange. */
  color?: string;
  /** Shown in the middle of the ring. */
  children?: ReactNode;
  /** True when the surrounding control already says the progress: screen readers skip the ring. */
  decorative?: boolean;
}

/** A ring that fills clockwise from the top, like the Activity rings. */
export function ProgressRing({
  fraction,
  size,
  strokeWidth = 4,
  color,
  children,
  decorative = false,
}: ProgressRingProps) {
  const { palette } = useHungryTheme();
  const reduceMotion = useReduceMotion();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(reduceMotion ? clamped : 0);

  useEffect(() => {
    progress.value = reduceMotion
      ? clamped
      : withTiming(clamped, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [clamped, progress, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View
      {...(decorative
        ? { accessible: false, importantForAccessibility: "no-hide-descendants" as const }
        : {
            accessible: true,
            accessibilityRole: "progressbar" as const,
            "aria-valuemin": 0,
            "aria-valuemax": 100,
            "aria-valuenow": Math.round(clamped * 100),
          })}
      style={{ alignItems: "center", height: size, justifyContent: "center", width: size }}
    >
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={palette.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color ?? palette.orange}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}
