import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle, type DimensionValue } from "react-native";
import { useHungryTheme } from "@/theme";

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Skeleton — Themed placeholder for loading states.
 * Uses a shimmer animation to indicate progress.
 */
export function Skeleton({ width, height, borderRadius, style }: SkeletonProps) {
  const { palette, radii } = useHungryTheme();
  const shimmerValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerValue]);

  const opacity = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View
      style={[
        styles.container,
        {
          width: width ?? ("100%" as DimensionValue),
          height: height ?? (20 as DimensionValue),
          borderRadius: borderRadius ?? radii.md,
          backgroundColor: palette.bgMuted,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: palette.border,
            opacity,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});
