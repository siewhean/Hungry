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
  const {
    componentCornerCurve,
    componentRadii,
    componentSizes,
    motion,
    opacity: opacityTokens,
    palette,
    reducedMotion,
  } = useHungryTheme();
  const opacity = useRef(new Animated.Value(opacityTokens.skeletonMin)).current;
  const resolvedHeight = height ?? componentSizes.skeletonLine;
  const resolvedRadius = borderRadius ?? componentRadii.card;

  useEffect(() => {
    // Reduce Motion: a still placeholder at its resting opacity, no looping pulse.
    if (reducedMotion) {
      opacity.setValue(opacityTokens.skeletonMin);
      return;
    }
    const animation = Animated.loop(
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
    );
    animation.start();

    return () => {
      animation.stop();
      opacity.stopAnimation();
    };
  }, [
    motion.skeleton,
    opacity,
    opacityTokens.skeletonMax,
    opacityTokens.skeletonMin,
    reducedMotion,
  ]);

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
          borderCurve: componentCornerCurve.borderCurve,
          opacity,
        },
        style,
      ]}
    />
  );
}
