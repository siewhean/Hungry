import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppSymbol, AppText } from "@/components/ui";
import { nextRankLabel, usePointsScoreBar } from "@/features/leaderboard/pointsScoreBar";
import * as Haptics from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

/** How long the bar stays before it slides away. */
export const SCORE_BAR_SHOW_MS = 4500;
const COUNT_UP_MS = 900;

/**
 * Slides in at the top after you earn points: the points counting up, your rank this week, and a
 * bar filling toward passing the next person. Tap it to open the Leaderboard.
 */
export function PointsScoreBar({ onOpenLeaderboard }: { onOpenLeaderboard: () => void }) {
  const bar = usePointsScoreBar((state) => state.bar);
  const dismiss = usePointsScoreBar((state) => state.dismiss);
  const { componentRadii, palette, reducedMotion, shadows, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0)).current;
  const count = useRef(new Animated.Value(0)).current;
  const [shownPoints, setShownPoints] = useState(0);

  useEffect(() => {
    if (!bar) return undefined;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const target = bar.goal?.progress ?? 1;
    if (reducedMotion) {
      slide.setValue(1);
      fill.setValue(target);
      setShownPoints(bar.earned);
    } else {
      slide.setValue(0);
      fill.setValue(0);
      count.setValue(0);
      setShownPoints(0);
      const listener = count.addListener(({ value }) => setShownPoints(Math.round(value)));
      Animated.parallel([
        Animated.spring(slide, { toValue: 1, useNativeDriver: true, friction: 8 }),
        Animated.timing(count, {
          toValue: bar.earned,
          duration: COUNT_UP_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(fill, {
          toValue: target,
          duration: COUNT_UP_MS,
          delay: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start(() => setShownPoints(bar.earned));
      const timer = setTimeout(dismiss, SCORE_BAR_SHOW_MS);
      return () => {
        clearTimeout(timer);
        count.removeListener(listener);
      };
    }
    const timer = setTimeout(dismiss, SCORE_BAR_SHOW_MS);
    return () => clearTimeout(timer);
  }, [bar, count, dismiss, fill, reducedMotion, slide]);

  if (!bar) return null;
  const rankText = bar.rank ? `#${bar.rank} this week` : "This week";
  const goalText = nextRankLabel(bar.goal, bar.rank);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        left: spacing[4],
        position: "absolute",
        right: spacing[4],
        top: insets.top + spacing[2],
        opacity: slide,
        transform: [
          { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) },
        ],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Plus ${bar.earned} points. ${rankText}. ${goalText}. Open the leaderboard.`}
        accessibilityLiveRegion="polite"
        onPress={() => {
          dismiss();
          onOpenLeaderboard();
        }}
        style={[
          shadows.card,
          {
            backgroundColor: palette.text,
            borderRadius: componentRadii.card,
            gap: spacing[2],
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
          },
        ]}
      >
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
          <AppSymbol name="leaderboard" color={palette.orange} size={18} />
          <AppText variant="bodyBold" style={{ color: palette.bg }}>
            {`+${shownPoints} ${bar.earned === 1 ? "point" : "points"}`}
          </AppText>
          <View style={{ flex: 1 }} />
          <AppText variant="micro" style={{ color: palette.bg, opacity: 0.8 }}>
            {rankText}
          </AppText>
        </View>
        <View
          style={{
            backgroundColor: palette.border,
            borderRadius: 3,
            height: 6,
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={{
              backgroundColor: palette.orange,
              height: 6,
              width: fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
            }}
          />
        </View>
        <AppText variant="micro" style={{ color: palette.bg }}>
          {goalText}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}
