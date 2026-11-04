import { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useHungryTheme } from "@/theme";

/** The iOS switch size (51 x 31 pt), so it matches the system one. */
export const SWITCH_TRACK_WIDTH = 51;
export const SWITCH_TRACK_HEIGHT = 31;
const THUMB_SIZE = 27;
const THUMB_INSET = (SWITCH_TRACK_HEIGHT - THUMB_SIZE) / 2;
/** How far the thumb travels from off to on. */
export const SWITCH_THUMB_TRAVEL = SWITCH_TRACK_WIDTH - THUMB_SIZE - THUMB_INSET * 2;
/** The thumb stretches this much while held. */
const THUMB_STRETCH = 4;

const SWITCH_SPRING = { damping: 14, mass: 0.7, stiffness: 280 } as const;
const PRESS_SPRING = { damping: 16, stiffness: 400 } as const;

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
 * little and stretches while pressed. The animation runs on the UI thread, so it stays smooth
 * while the JS thread saves the setting; under Reduce Motion it jumps to the end state.
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
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(value ? 1 : 0);
  const press = useSharedValue(0);

  useEffect(() => {
    const target = value ? 1 : 0;
    progress.set(reduceMotion ? target : withSpring(target, SWITCH_SPRING));
  }, [progress, reduceMotion, value]);

  const squash = (to: number) => {
    if (reduceMotion) return;
    press.set(withSpring(to, PRESS_SPRING));
  };

  const offColor = offTrackColor ?? palette.border;
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [offColor, palette.orange]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    // When on, the stretched thumb grows to the left so it stays in the track.
    transform: [
      {
        translateX:
          progress.get() * SWITCH_THUMB_TRAVEL - press.get() * progress.get() * THUMB_STRETCH,
      },
    ],
    width: interpolate(press.get(), [0, 1], [THUMB_SIZE, THUMB_SIZE + THUMB_STRETCH]),
  }));

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
        style={[
          {
            borderRadius: SWITCH_TRACK_HEIGHT / 2,
            height: SWITCH_TRACK_HEIGHT,
            justifyContent: "center",
            paddingHorizontal: THUMB_INSET,
            width: SWITCH_TRACK_WIDTH,
          },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            shadows.card,
            {
              backgroundColor: palette.white,
              borderRadius: THUMB_SIZE / 2,
              height: THUMB_SIZE,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
