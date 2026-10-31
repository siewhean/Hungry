import { useEffect, useMemo, useState } from "react";

import {
  Animated,
  Easing,
  PixelRatio,
  StyleSheet,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { getTextMaxFontSizeMultiplier, type TextVariant } from "@/components/ui/AppText";
import { useHungryTheme } from "@/theme";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * One clock drives every skeleton on screen, so the whole page shimmers in step instead of each
 * block pulsing on its own. It runs only while at least one skeleton is mounted, on the native
 * driver, and stops when the last one goes.
 */
const sweepClock = new Animated.Value(0);
let mountedSkeletons = 0;
let sweepAnimation: Animated.CompositeAnimation | null = null;

function retainSweepClock(duration: number): () => void {
  mountedSkeletons += 1;
  if (mountedSkeletons === 1) {
    sweepClock.setValue(0);
    const animation = Animated.loop(
      Animated.timing(sweepClock, {
        toValue: 1,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    sweepAnimation = animation;
    animation.start();
  }
  return () => {
    mountedSkeletons = Math.max(0, mountedSkeletons - 1);
    if (mountedSkeletons === 0 && sweepAnimation) {
      sweepAnimation.stop();
      sweepAnimation = null;
    }
  };
}

/** How many skeletons are drawing the sweep right now (0 when none are mounted or Reduce Motion is on). */
export function getActiveSkeletonCount(): number {
  return mountedSkeletons;
}

/** A grey placeholder block with a soft highlight that sweeps across it (still under Reduce Motion). */
export function Skeleton({ width = "100%", height, borderRadius, style }: SkeletonProps) {
  const {
    colorScheme,
    componentCornerCurve,
    componentRadii,
    componentSizes,
    motion,
    opacity: opacityTokens,
    palette,
    reducedMotion,
  } = useHungryTheme();
  const [blockWidth, setBlockWidth] = useState(0);
  const resolvedHeight = height ?? componentSizes.skeletonLine;
  const resolvedRadius = borderRadius ?? componentRadii.card;

  useEffect(() => {
    // Reduce Motion: a still placeholder, no sweep.
    if (reducedMotion) {
      return;
    }
    return retainSweepClock(motion.skeleton);
  }, [motion.skeleton, reducedMotion]);

  const translateX = useMemo(
    () => sweepClock.interpolate({ inputRange: [0, 1], outputRange: [-blockWidth, blockWidth] }),
    [blockWidth],
  );
  const highlight =
    colorScheme === "dark"
      ? (["rgba(255,255,255,0)", "rgba(255,255,255,0.16)", "rgba(255,255,255,0)"] as const)
      : (["rgba(255,255,255,0)", "rgba(255,255,255,0.7)", "rgba(255,255,255,0)"] as const);
  const handleLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next !== blockWidth) setBlockWidth(next);
  };

  return (
    <View
      accessibilityLabel="Loading content"
      accessibilityRole="progressbar"
      onLayout={reducedMotion ? undefined : handleLayout}
      style={[
        {
          width: width as DimensionValue,
          height: resolvedHeight as DimensionValue,
          borderRadius: resolvedRadius,
          borderCurve: componentCornerCurve.borderCurve,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: palette.border,
            opacity: reducedMotion ? opacityTokens.skeletonMin : opacityTokens.skeletonMax,
          },
        ]}
      />
      {!reducedMotion && blockWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            bottom: 0,
            left: 0,
            position: "absolute",
            top: 0,
            transform: [{ translateX }],
            width: blockWidth,
          }}
        >
          <LinearGradient
            colors={highlight}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * A placeholder for one line of text. Its box is exactly as tall as that line of AppText would be
 * (line height at the phone's text size, capped the way AppText caps it), with a bar a little
 * shorter than the type inside, so the page does not shift when the real text arrives.
 */
export function SkeletonText({
  variant,
  width = "100%",
  style,
}: {
  variant: TextVariant;
  width?: number | string;
  style?: StyleProp<ViewStyle>;
}) {
  const { fontScaling, radii, typography } = useHungryTheme();
  const { fontSize, lineHeight } = typography[variant];
  const scale = Math.min(
    PixelRatio.getFontScale(),
    getTextMaxFontSizeMultiplier(variant, fontScaling),
  );
  return (
    <View
      style={[
        { height: Math.round(lineHeight * scale), justifyContent: "center" },
        { width: width as DimensionValue },
        style,
      ]}
    >
      <Skeleton width="100%" height={Math.round(fontSize * 0.75)} borderRadius={radii.sm} />
    </View>
  );
}
