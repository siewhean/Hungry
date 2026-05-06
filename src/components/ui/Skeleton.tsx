import { useEffect, useRef } from "react";
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";

import { useHungryTheme } from "@/theme";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = "100%", height, borderRadius, style }: SkeletonProps) {
  const { componentSizes, motion, opacity: opacityTokens, palette, radii } = useHungryTheme();
  const opacity = useRef(new Animated.Value(opacityTokens.skeletonMin)).current;
  const resolvedHeight = height ?? componentSizes.skeletonLine;
  const resolvedRadius = borderRadius ?? radii.sm;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: opacityTokens.skeletonMax,
          duration: Math.round(motion.skeleton / 2),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: opacityTokens.skeletonMin,
          duration: Math.round(motion.skeleton / 2),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [motion.skeleton, opacity, opacityTokens.skeletonMax, opacityTokens.skeletonMin]);

  return (
    <Animated.View
      accessibilityLabel="Loading content"
      accessibilityRole="progressbar"
      style={[
        {
          width: width as DimensionValue,
          height: resolvedHeight as DimensionValue,
          backgroundColor: palette.border,
          borderRadius: resolvedRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}
