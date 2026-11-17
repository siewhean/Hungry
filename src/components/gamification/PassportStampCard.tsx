import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

import { AppText } from "@/components/ui/AppText";
import { PassportStampBadge } from "@/components/gamification/PassportStampBadge";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useHungryTheme } from "@/theme";
import type {
  EarnedPassportStamp,
  PassportCategory,
  PassportNextStamp,
  PassportStampDefinition,
} from "@/types/domain";

interface PassportStampCardProps {
  category: PassportCategory;
  stamp: PassportStampDefinition | EarnedPassportStamp;
  earned?: boolean;
  nextStamp?: PassportNextStamp | null;
  celebrating?: boolean;
  reduceMotion?: boolean;
}

export function PassportStampCard({
  category,
  stamp,
  earned = false,
  nextStamp = null,
  celebrating = false,
  reduceMotion = false,
}: PassportStampCardProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const prefersReducedMotion = useReduceMotion();
  const shouldReduceMotion = reduceMotion || prefersReducedMotion;
  const progressFraction =
    nextStamp && nextStamp.stamp.id === stamp.id ? nextStamp.progressFraction : earned ? 1 : 0;
  const stampScale = useSharedValue(1);
  const stampRotate = useSharedValue(0);

  useEffect(() => {
    if (!celebrating || shouldReduceMotion) {
      stampScale.value = 1;
      stampRotate.value = 0;
      return;
    }
    stampScale.value = withSequence(
      withTiming(1.16, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 13, stiffness: 210 }),
    );
    stampRotate.value = withSequence(
      withTiming(-6, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withSpring(-2, { damping: 14, stiffness: 180 }),
    );
  }, [celebrating, shouldReduceMotion, stampRotate, stampScale]);

  const stampAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: stampScale.value }, { rotate: `${stampRotate.value}deg` }],
  }));

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: earned ? palette.orangeLight : palette.surface,
          borderColor: earned ? palette.orange : palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          padding: spacing[4],
          gap: spacing[3],
        },
      ]}
    >
      <View style={[styles.row, { gap: spacing[3] }]}>
        <Animated.View style={stampAnimatedStyle}>
          <PassportStampBadge stamp={stamp} earned={earned} />
        </Animated.View>
        <View style={styles.copy}>
          <AppText variant="bodySmallBold" numberOfLines={1}>
            {category.name}
          </AppText>
          <AppText tone="muted" variant="micro" numberOfLines={2}>
            {stamp.subtitle} · {stamp.description}
          </AppText>
        </View>
      </View>

      <View style={{ gap: spacing[1] }}>
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: palette.border, borderRadius: radii.pill },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: earned ? palette.orange : palette.amber,
                borderRadius: radii.pill,
                width: `${Math.min(progressFraction * 100, 100)}%`,
              },
            ]}
          />
        </View>
        <View style={styles.metaRow}>
          <AppText tone="muted" variant="micro">
            {earned ? "Stamped" : `${nextStamp?.remainingCount ?? stamp.threshold} to next stamp`}
          </AppText>
          <AppText variant="micro" style={{ color: earned ? palette.orange : palette.textMuted }}>
            {stamp.threshold} tried
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {},
  copy: {
    flex: 1,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressFill: {
    height: "100%",
  },
  progressTrack: {
    height: 6,
    overflow: "hidden",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
});
