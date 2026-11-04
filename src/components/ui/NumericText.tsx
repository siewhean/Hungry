import { useLayoutEffect, useState } from "react";
import { Animated, Easing, View, type ViewStyle } from "react-native";

import { AppText, type TextVariant } from "@/components/ui/AppText";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useHungryTheme } from "@/theme";

export const NUMERIC_TEXT_DURATION_MS = 320;

type TextProps = Omit<React.ComponentProps<typeof AppText>, "children">;

type Props = TextProps & {
  /** The number to show, as text ("12", "1,204", "–"). */
  value: string;
  /**
   * Which way the digits roll. Left out, it follows the value: lower than before rolls down,
   * anything else rolls up (SwiftUI's `.contentTransition(.numericText(countsDown:))`).
   */
  countsDown?: boolean;
  /** Layout for the box around the text. */
  containerStyle?: ViewStyle;
};

/** The number in a string ("1,204" -> 1204), or null when it holds none (a dash while loading). */
function numberIn(text: string): number | null {
  const digits = text.replace(/[^0-9.]/g, "");
  return digits === "" ? null : Number(digits);
}

type Roll = { current: string; previous: string | null; countsDown: boolean };

/**
 * A number that changes while it is on screen (the stall count, the stamp count): the numeric-text
 * transition. Only the digits that changed roll, the new one in and the old one out with a fade,
 * upward as the number grows and downward as it counts down; the rest stay still. The first value
 * just appears. Under Reduce Motion the value is swapped at once. Screen readers only ever see
 * the current value.
 */
export function NumericText({
  value,
  countsDown: countsDownProp,
  containerStyle,
  style,
  variant = "body",
  ...textProps
}: Props) {
  const reduceMotion = useReduceMotion();
  const { typography } = useHungryTheme();
  const [progress] = useState(() => new Animated.Value(1));
  const [roll, setRoll] = useState<Roll>({ current: value, previous: null, countsDown: false });

  // Take the new value in the same render, so it is never shown without its roll.
  if (roll.current !== value) {
    const before = numberIn(roll.current);
    const after = numberIn(value);
    setRoll({
      current: value,
      previous: reduceMotion ? null : roll.current,
      countsDown: countsDownProp ?? (before !== null && after !== null && after < before),
    });
  }

  useLayoutEffect(() => {
    if (roll.previous === null) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: NUMERIC_TEXT_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) setRoll((r) => (r.current === roll.current ? { ...r, previous: null } : r));
    });
    return () => animation.stop();
  }, [progress, roll.current, roll.previous]);

  // Tabular digits keep every figure the same width, so the number does not shimmy as it rolls.
  const digitStyle = [...(Array.isArray(style) ? style : style ? [style] : []), TABULAR];
  const text = (children: string, key?: string) => (
    <AppText key={key} variant={variant} style={digitStyle} {...textProps}>
      {children}
    </AppText>
  );

  if (roll.previous === null) {
    return <View style={containerStyle}>{text(roll.current)}</View>;
  }

  const travel = Math.round(((typography[variant as TextVariant]?.fontSize ?? 16) as number) * 0.6);
  const from = roll.countsDown ? -travel : travel;
  const enter = {
    opacity: progress,
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) },
    ],
  };
  const leave = {
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -from] }) },
    ],
  };

  // Line the old and new values up from the right, so units stay under units when 99 becomes 100.
  const width = Math.max(roll.current.length, roll.previous.length);
  const now = roll.current.padStart(width, "\0").split("");
  const was = roll.previous.padStart(width, "\0").split("");

  return (
    <View
      accessible
      accessibilityLabel={roll.current}
      style={[{ flexDirection: "row" }, containerStyle]}
    >
      {now.map((char, index) => {
        const old = was[index];
        const shown = char === "\0" ? "" : char;
        if (char === old) return text(shown, `s${index}`);
        return (
          <View key={`r${index}`}>
            <Animated.View style={enter}>{text(shown)}</Animated.View>
            {old === "\0" ? null : (
              <Animated.View
                accessibilityElementsHidden
                aria-hidden
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
                style={[{ left: 0, position: "absolute", top: 0 }, leave]}
              >
                {text(old)}
              </Animated.View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const TABULAR = { fontVariant: ["tabular-nums" as const] };
