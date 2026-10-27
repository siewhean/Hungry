import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useHungryTheme } from "@/theme";

const LIGHT_SKY = ["#FFD7BF", "#FFEADD", "#FFFFFF"] as const;

type Blob = { size: number; top: string; left: string; dx: number; dy: number; duration: number };

// Soft warm glows that drift slowly behind the content.
const BLOBS: readonly Blob[] = [
  { size: 280, top: "2%", left: "-22%", dx: 36, dy: 26, duration: 9000 },
  { size: 220, top: "30%", left: "62%", dx: -30, dy: 34, duration: 11000 },
  { size: 260, top: "64%", left: "-18%", dx: 28, dy: -30, duration: 10000 },
];

/** Warm gradient sky with slowly drifting glows. Still under Reduce Motion. */
export function WelcomeBackdrop() {
  const { palette, colorScheme } = useHungryTheme();
  const reduceMotion = useReduceMotion();
  const drift = useRef(BLOBS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (reduceMotion) {
      drift.forEach((value) => value.setValue(0));
      return;
    }
    const loops = drift.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: BLOBS[i]!.duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: BLOBS[i]!.duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => {
      loops.forEach((loop) => loop.stop());
      drift.forEach((value) => value.stopAnimation());
    };
  }, [drift, reduceMotion]);

  const colors =
    colorScheme === "dark" ? ([palette.bgSoft, palette.bg, palette.bg] as const) : LIGHT_SKY;

  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
    >
      <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />
      {BLOBS.map((blob, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            top: blob.top as `${number}%`,
            left: blob.left as `${number}%`,
            width: blob.size,
            height: blob.size,
            borderRadius: blob.size / 2,
            backgroundColor: palette.orange,
            opacity: colorScheme === "dark" ? 0.1 : 0.16,
            transform: [
              {
                translateX: drift[i]!.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, blob.dx],
                }),
              },
              {
                translateY: drift[i]!.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, blob.dy],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}
