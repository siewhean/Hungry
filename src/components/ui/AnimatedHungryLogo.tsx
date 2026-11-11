import { useEffect, useMemo } from "react";
import { View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { HUNGRY_LOGO_ICON, HUNGRY_LOGO_TEXT } from "@/constants/brandAssets";
import {
  LOGO_SPLASH_DURATION_MS,
  logoSplashFrame,
  logoSplashLayout,
  logoSplashLockupWidth,
} from "@/features/splash/logoSplash";
import { AccessibleImage } from "./AccessibleImage";

type AnimatedHungryLogoProps = {
  /** false shows the finished logo straight away (Reduce Motion). */
  animated?: boolean;
  /** Called if the icon or wordmark file fails to load. */
  onImageError?: (error: unknown) => void;
  testID?: string;
};

/**
 * The official Hungry logo springing into place: the icon pops in and bounces up, the wordmark
 * rises beneath it, then both give one small hop and rest in the exact official arrangement.
 * Runs on the UI thread from one linear clock (see `logoSplashFrame`). The artwork is the
 * supplied PNGs only; nothing is redrawn or re-typeset.
 */
export function AnimatedHungryLogo({
  animated = true,
  onImageError,
  testID,
}: AnimatedHungryLogoProps) {
  const { width, height } = useWindowDimensions();
  const layout = useMemo(
    () => logoSplashLayout(logoSplashLockupWidth(width, height)),
    [width, height],
  );
  const { unit } = layout;

  const time = useSharedValue(animated ? 0 : LOGO_SPLASH_DURATION_MS);
  useEffect(() => {
    if (!animated) {
      time.set(LOGO_SPLASH_DURATION_MS);
      return;
    }
    time.set(0);
    time.set(
      withTiming(LOGO_SPLASH_DURATION_MS, {
        duration: LOGO_SPLASH_DURATION_MS,
        easing: Easing.linear,
      }),
    );
  }, [animated, time]);

  const groupStyle = useAnimatedStyle(() => {
    const frame = logoSplashFrame(time.get());
    return {
      transform: [{ translateY: frame.groupTranslateY * unit }, { scale: frame.groupScale }],
    };
  }, [unit]);
  const iconStyle = useAnimatedStyle(() => {
    const frame = logoSplashFrame(time.get());
    return {
      opacity: frame.iconOpacity,
      transform: [
        { translateY: frame.iconTranslateY * unit },
        { scaleX: frame.iconScaleX },
        { scaleY: frame.iconScaleY },
      ],
    };
  }, [unit]);
  const wordmarkStyle = useAnimatedStyle(() => {
    const frame = logoSplashFrame(time.get());
    return {
      opacity: frame.wordmarkOpacity,
      transform: [{ translateY: frame.wordmarkTranslateY * unit }, { scale: frame.wordmarkScale }],
    };
  }, [unit]);

  return (
    <View
      accessible
      accessibilityLabel="Hungry logo"
      accessibilityRole="image"
      testID={testID}
      style={{ width: layout.lockup.width, height: layout.lockup.height }}
    >
      <Animated.View style={[{ width: "100%", height: "100%" }, groupStyle]}>
        <Animated.View
          style={[
            {
              position: "absolute",
              left: layout.icon.left,
              top: layout.icon.top,
              width: layout.icon.size,
              height: layout.icon.size,
            },
            iconStyle,
          ]}
        >
          <AccessibleImage
            source={HUNGRY_LOGO_ICON}
            contentFit="contain"
            decorative
            onError={onImageError}
            style={{ width: "100%", height: "100%" }}
          />
        </Animated.View>
        <Animated.View
          style={[
            {
              position: "absolute",
              left: layout.wordmark.left,
              top: layout.wordmark.top,
              width: layout.wordmark.width,
              height: layout.wordmark.height,
            },
            wordmarkStyle,
          ]}
        >
          <AccessibleImage
            source={HUNGRY_LOGO_TEXT}
            contentFit="contain"
            decorative
            onError={onImageError}
            style={{ width: "100%", height: "100%" }}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
