/**
 * CredEarnedToast — ephemeral overlay that slides up to confirm a cred award.
 *
 * Usage: mount once in the root layout (alongside FloatingToast).
 * It observes `lastEarnedPoints` from useFoodCredStore and auto-dismisses.
 *
 * Deliberately understated — no confetti, no fireworks, just a brief confirmation.
 */

import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useHungryTheme } from "@/theme";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { AppText } from "@/components/ui/AppText";
import { useFoodCredStore } from "@/store/useFoodCredStore";
import { resolveFoodCredLevel } from "@/constants/foodCredConfig";

const AUTO_DISMISS_MS = 2500;

export function CredEarnedToast() {
  const { palette, radii, shadows, spacing, zIndex } = useHungryTheme();
  const lastEarnedPoints = useFoodCredStore((s) => s.lastEarnedPoints);
  const reduceMotion = useReduceMotion();
  const totalPoints = useFoodCredStore((s) => s.totalPoints);
  const currentLevel = resolveFoodCredLevel(totalPoints);

  // Track which "version" of the toast we're showing — a new non-zero value triggers show
  const lastShownRef = useRef(0);
  const visible = lastEarnedPoints > 0 && lastEarnedPoints !== lastShownRef.current;

  // Animated scale pop on mount
  const scale = useSharedValue(0.85);
  useEffect(() => {
    if (!visible) return;
    lastShownRef.current = lastEarnedPoints;
    if (reduceMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withSequence(
      withSpring(1.05, { damping: 10, stiffness: 250 }),
      withDelay(100, withSpring(1, { damping: 14, stiffness: 180 })),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [visible, lastEarnedPoints, reduceMotion, scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={[styles.wrapper, { zIndex: zIndex.toast + 1 }]}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.duration(200).springify()}
        exiting={reduceMotion ? undefined : FadeOutUp.duration(180).delay(AUTO_DISMISS_MS - 180)}
      >
        <Animated.View style={animStyle}>
          <View
            style={[
              shadows.floating,
              styles.pill,
              {
                backgroundColor: palette.surface,
                borderColor: palette.orange,
                borderRadius: radii.pill,
                borderWidth: 1.5,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[2],
              },
            ]}
          >
            <AppText
              style={{ color: palette.orange, fontWeight: "700", fontSize: 15, lineHeight: 20 }}
            >
              +{lastEarnedPoints} Food Cred
            </AppText>
            <AppText tone="muted" variant="micro" style={{ marginTop: 2 }}>
              {currentLevel.name}
            </AppText>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: "center",
  },
  wrapper: {
    alignItems: "center",
    bottom: 90,
    left: 0,
    position: "absolute",
    right: 0,
  },
});
