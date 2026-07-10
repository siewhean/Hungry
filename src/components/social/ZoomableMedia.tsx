import {
  StyleSheet,
  Pressable,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useHungryTheme } from "@/theme";
import { AccessibleImage } from "@/components/ui/AccessibleImage";

interface ZoomableMediaProps {
  uri: string;
  type: "image" | "video";
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
}

export function ZoomableMedia({
  uri,
  type,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  style,
}: ZoomableMediaProps) {
  if (type === "video") {
    return <ZoomableVideoHost uri={uri} accessibilityLabel={accessibilityLabel} style={style} />;
  }

  return (
    <ZoomableImage
      uri={uri}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={style}
    />
  );
}

function ZoomableVideoHost({
  uri,
  accessibilityLabel,
  style,
}: Pick<ZoomableMediaProps, "uri" | "accessibilityLabel" | "style">) {
  const { ZoomableVideo } = require("./ZoomableVideo") as typeof import("./ZoomableVideo");
  return <ZoomableVideo uri={uri} accessibilityLabel={accessibilityLabel} style={style} />;
}

function ZoomableImage({
  uri,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  style,
}: Pick<
  ZoomableMediaProps,
  "uri" | "accessibilityLabel" | "accessibilityHint" | "onPress" | "style"
>) {
  const { palette } = useHungryTheme();
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const resolvedAccessibilityLabel = accessibilityLabel ?? "Post image";

  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      focalX.value = e.focalX;
      focalY.value = e.focalY;
    })
    .onUpdate((e) => {
      scale.value = e.scale;
    })
    .onEnd(() => {
      scale.value = reduceMotion ? 1 : withSpring(1);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: focalX.value },
      { translateY: focalY.value },
      { scale: scale.value },
      { translateX: -focalX.value },
      { translateY: -focalY.value },
    ],
  }));

  return (
    <GestureDetector gesture={pinchGesture}>
      <Animated.View
        style={[styles.container, { backgroundColor: palette.mediaBackdrop }, style, animatedStyle]}
      >
        <Pressable
          accessible={Boolean(onPress)}
          accessibilityRole={onPress ? "button" : undefined}
          accessibilityLabel={onPress ? `Open ${resolvedAccessibilityLabel}` : undefined}
          accessibilityHint={onPress ? (accessibilityHint ?? "Opens this media item") : undefined}
          onPress={onPress}
          style={StyleSheet.absoluteFill}
        >
          {onPress ? (
            <AccessibleImage
              source={{ uri }}
              decorative
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <AccessibleImage
              source={{ uri }}
              accessibilityLabel={resolvedAccessibilityLabel}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
          )}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});
