import { useRef, useEffect } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { useHungryTheme } from "@/theme";

interface ReviewProgressBarProps {
  /** 1-indexed current step (1, 2, 3, 4) */
  currentStep: number;
  totalSteps: number;
}

/**
 * Thin animated progress bar + step dots for the quick review wizard.
 * Per Figma V2 Quick Review spec:
 * - Orange fill width animates based on step progress
 * - Step dots: filled = done, orange ring = active, grey = future
 */
export function ReviewProgressBar({ currentStep, totalSteps }: ReviewProgressBarProps) {
  const { palette, spacing, radii } = useHungryTheme();
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: currentStep / totalSteps,
      useNativeDriver: false,
      tension: 120,
      friction: 14,
    }).start();
  }, [currentStep, totalSteps, progressAnim]);

  return (
    <View style={[styles.container, { gap: spacing[3], paddingHorizontal: spacing[4] }]}>
      {/* Progress bar */}
      <View
        style={[
          styles.track,
          {
            backgroundColor: palette.bgSoft,
            borderRadius: radii.pill,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: palette.orange,
              borderRadius: radii.pill,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>

      {/* Step dots */}
      <View style={[styles.dotsRow, { gap: spacing[3] }]}>
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1;
          const isDone = stepNum < currentStep;
          const isActive = stepNum === currentStep;

          return (
            <View
              key={stepNum}
              accessibilityLabel={`Step ${stepNum} of ${totalSteps}`}
              style={[
                styles.dot,
                {
                  backgroundColor: isDone
                    ? palette.orange
                    : isActive
                      ? "transparent"
                      : palette.bgSoft,
                  borderColor: isActive ? palette.orange : "transparent",
                  borderWidth: isActive ? 2 : 0,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  track: {
    width: "100%",
    height: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
