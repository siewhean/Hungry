import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";

import { AccessibleImage, AppText } from "@/components/ui";
import { FOOD_SWAP_MS, arcSamples } from "@/features/onboarding/foodArc";
import { stopDirection } from "@/features/onboarding/sliderGeometry";
import { tasteSliderFoodImage } from "@/features/onboarding/tasteSliderFoods";
import type { TasteStop } from "@/features/onboarding/tasteSliderStops";
import { useHungryTheme } from "@/theme";

type Props = {
  stops: readonly TasteStop[];
  stopIndex: number;
  reduceMotion: boolean;
  size: number;
};

type Swap = { current: number; previous: number | null; direction: 1 | -1 };

/**
 * The picture above the slider. When the thumb passes into another stop the old dish rides off along
 * a semi-circle, turning and fading, and the new one rides in from the other side. Reduce Motion swaps
 * them without moving.
 */
export function FoodSwapStage({ stops, stopIndex, reduceMotion, size }: Props) {
  const { palette } = useHungryTheme();
  const progress = useRef(new Animated.Value(1)).current;
  const [swap, setSwap] = useState<Swap>({ current: stopIndex, previous: null, direction: 1 });
  const latest = useRef(stopIndex);

  useEffect(() => {
    if (stopIndex === latest.current) return;
    const direction = stopDirection(latest.current, stopIndex) === -1 ? -1 : 1;
    const previous = latest.current;
    latest.current = stopIndex;
    if (reduceMotion) {
      setSwap({ current: stopIndex, previous: null, direction });
      return;
    }
    setSwap({ current: stopIndex, previous, direction });
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: FOOD_SWAP_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setSwap((state) => ({ ...state, previous: null }));
    });
  }, [stopIndex, reduceMotion, progress]);

  const radius = size * 0.6;
  const leaving = useMemo(
    () => arcSamples("leaving", swap.direction, radius),
    [swap.direction, radius],
  );
  const entering = useMemo(
    () => arcSamples("entering", swap.direction, radius),
    [swap.direction, radius],
  );

  const poseStyle = (samples: typeof leaving) => ({
    opacity: progress.interpolate({ inputRange: samples.inputRange, outputRange: samples.opacity }),
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: samples.inputRange,
          outputRange: samples.translateX,
        }),
      },
      {
        translateY: progress.interpolate({
          inputRange: samples.inputRange,
          outputRange: samples.translateY,
        }),
      },
      {
        rotate: progress.interpolate({
          inputRange: samples.inputRange,
          outputRange: samples.rotate,
        }),
      },
      {
        scale: progress.interpolate({
          inputRange: samples.inputRange,
          outputRange: samples.scale,
        }),
      },
    ],
  });

  const dish = (index: number, animatedStyle: object | null) => {
    const stop = stops[index]!;
    const source = tasteSliderFoodImage(stop.slug);
    if (!source) return null;
    return (
      <Animated.View
        key={`${stop.slug}-${animatedStyle ? "anim" : "rest"}`}
        pointerEvents="none"
        style={[{ height: size, position: "absolute", width: size }, animatedStyle]}
      >
        <AccessibleImage decorative contentFit="contain" source={source} style={{ flex: 1 }} />
      </Animated.View>
    );
  };

  const currentStop = stops[swap.current]!;
  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ alignItems: "center", height: size, width: size }}
      >
        {swap.previous !== null ? dish(swap.previous, poseStyle(leaving)) : null}
        {dish(swap.current, swap.previous !== null ? poseStyle(entering) : null)}
      </View>
      <AppText variant="bodyBold" style={{ color: palette.text, textAlign: "center" }}>
        {currentStop.dish}
      </AppText>
      <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
        {currentStop.caption}
      </AppText>
    </View>
  );
}
