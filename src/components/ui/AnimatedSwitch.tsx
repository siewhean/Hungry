import { useEffect, useState } from "react";
import { Animated, Pressable } from "react-native";

import { useHungryTheme } from "@/theme";

export const SWITCH_TRACK_WIDTH = 52;
export const SWITCH_TRACK_HEIGHT = 32;
const THUMB_SIZE = 26;
const THUMB_INSET = (SWITCH_TRACK_HEIGHT - THUMB_SIZE) / 2;
/** How far the thumb travels from off to on. */
export const SWITCH_THUMB_TRAVEL = SWITCH_TRACK_WIDTH - THUMB_SIZE - THUMB_INSET * 2;

type Props = {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** False when a surrounding row is the accessible switch. */
  accessible?: boolean;
  /** Off-track colour; defaults to the theme border. */
  offTrackColor?: string;
  testID?: string;
};

/**
 * The app's switch: orange when on (no platform green), with a springy thumb that overshoots a
 * little and squashes while pressed.
 */
export function AnimatedSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  accessible = true,
  offTrackColor,
  testID,
}: Props) {
  const { palette, shadows } = useHungryTheme();
  const [progress] = useState(() => new Animated.Value(value ? 1 : 0));
  const [press] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(progress, {
      toValue: value ? 1 : 0,
      damping: 14,
      mass: 0.7,
      stiffness: 280,
      useNativeDriver: false,
    }).start();
  }, [progress, value]);

  const squash = (to: number) =>
    Animated.spring(press, {
      toValue: to,
      damping: 16,
      stiffness: 400,
      useNativeDriver: false,
    }).start();

  return (
    <Pressable
      testID={testID}
      accessible={accessible}
      accessibilityRole={accessible ? "switch" : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessible ? { checked: value, disabled } : undefined}
      accessibilityElementsHidden={!accessible}
      importantForAccessibility={accessible ? "auto" : "no-hide-descendants"}
      disabled={disabled || !onValueChange}
      hitSlop={8}
      onPressIn={() => squash(1)}
      onPressOut={() => squash(0)}
      onPress={() => onValueChange?.(!value)}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View
        style={{
          backgroundColor: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [offTrackColor ?? palette.border, palette.orange],
          }),
          borderRadius: SWITCH_TRACK_HEIGHT / 2,
          height: SWITCH_TRACK_HEIGHT,
          justifyContent: "center",
          paddingHorizontal: THUMB_INSET,
          width: SWITCH_TRACK_WIDTH,
        }}
      >
        <Animated.View
          style={[
            shadows.card,
            {
              backgroundColor: palette.white,
              borderRadius: THUMB_SIZE / 2,
              height: THUMB_SIZE,
              transform: [
                {
                  // When on, the stretched thumb grows to the left so it stays in the track.
                  translateX: Animated.subtract(
                    progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, SWITCH_THUMB_TRAVEL],
                    }),
                    Animated.multiply(Animated.multiply(press, progress), 4),
                  ),
                },
              ],
              // Stretches a little while held, like the platform switch.
              width: press.interpolate({
                inputRange: [0, 1],
                outputRange: [THUMB_SIZE, THUMB_SIZE + 4],
              }),
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
