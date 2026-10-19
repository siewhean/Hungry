/**
 * CredEarnedToast — ephemeral overlay that slides up to confirm a cred award.
 *
 * Usage: mount once in the root layout (alongside FloatingToast).
 * It subscribes to cred awards in useFoodCredStore and auto-dismisses after each one.
 *
 * Deliberately understated — no confetti, no fireworks, just a brief confirmation.
 */

import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "@/lib/haptics";

import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui/AppText";
import { useFoodCredStore } from "@/store/useFoodCredStore";
import { resolveFoodCredLevel } from "@/constants/foodCredConfig";

const AUTO_DISMISS_MS = 2500;

export function CredEarnedToast() {
  const { palette, radii, shadows, spacing, zIndex } = useHungryTheme();
  const reduceMotion = useReduceMotion();
  const totalPoints = useFoodCredStore((s) => s.totalPoints);
  const currentLevel = resolveFoodCredLevel(totalPoints);

  // Each award is its own event (id), so two awards of the same amount both show,
  // and a timer hides the toast instead of relying on a re-render.
  const [award, setAward] = useState<{ id: number; points: number } | null>(null);
  const awardIdRef = useRef(0);
  useEffect(
    () =>
      useFoodCredStore.subscribe((state, previous) => {
        if (state.lastEarnedPoints <= 0 || state.totalPoints === previous.totalPoints) return;
        awardIdRef.current += 1;
        setAward({ id: awardIdRef.current, points: state.lastEarnedPoints });
      }),
    [],
  );
  useEffect(() => {
    if (!award) return;
    AccessibilityInfo.announceForAccessibility(`Plus ${award.points} Food Cred`);
    const timer = setTimeout(() => {
      setAward((current) => (current?.id === award.id ? null : current));
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [award]);

  // Animated scale pop on each award
  const scale = useSharedValue(0.85);
  useEffect(() => {
    if (!award) return;
    if (reduceMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withSequence(
      withSpring(1.05, { damping: 10, stiffness: 250 }),
      withDelay(100, withSpring(1, { damping: 14, stiffness: 180 })),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [award, reduceMotion, scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!award) return null;
  const lastEarnedPoints = award.points;

  return (
    <View pointerEvents="none" style={[styles.wrapper, { zIndex: zIndex.toast + 1 }]}>
      <Animated.View
        key={award.id}
        entering={reduceMotion ? undefined : FadeInDown.duration(200).springify()}
        exiting={reduceMotion ? undefined : FadeOutUp.duration(180)}
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
