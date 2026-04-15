import { useEffect, useRef } from "react";
import {
  Animated,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useHungryTheme } from "@/theme";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width = "100%",
  height = 20,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const { motion, palette } = useHungryTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: Math.round(motion.skeleton / 2),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: Math.round(motion.skeleton / 2),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [motion.skeleton, opacity]);

  return (
    <Animated.View
      accessibilityLabel="Loading content"
      accessibilityRole="progressbar"
      style={[
        {
          width: width as DimensionValue,
          height: height as DimensionValue,
          backgroundColor: palette.border,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}
