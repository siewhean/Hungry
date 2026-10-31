import { useEffect, useRef } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { AppSymbol } from "@/components/ui";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { selectHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

/** The heart starts a little small and springs to full size when it fills. */
export const HEART_SPRING_FROM = 0.85;
export const HEART_SPRING = { damping: 15, stiffness: 300 } as const;

/**
 * The save heart on a dish card. It has its own "saved" colour (never the error red), springs once
 * when it fills (not on first render, and not at all with Reduce Motion on) and ticks once.
 */
export function SaveHeartButton({
  accessibilityLabel,
  onPress,
  saved,
  style,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  saved: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useHungryTheme();
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const wasSaved = useRef(saved);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    const justSaved = saved && !wasSaved.current;
    wasSaved.current = saved;
    if (!justSaved || reduceMotion) return;
    scale.set(HEART_SPRING_FROM);
    scale.set(withSpring(1, HEART_SPRING));
  }, [reduceMotion, saved, scale]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: saved }}
      hitSlop={4}
      onPress={() => {
        selectHaptic();
        onPress();
      }}
      style={style}
    >
      <Animated.View style={animatedStyle}>
        <AppSymbol
          name={saved ? "saved" : "save"}
          color={saved ? palette.saved : palette.textMuted}
          size={20}
          weight="medium"
        />
      </Animated.View>
    </Pressable>
  );
}
