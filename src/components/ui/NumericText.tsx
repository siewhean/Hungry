import { useLayoutEffect, useState } from "react";
import { Animated, Easing, View, type ViewStyle } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { useReduceMotion } from "@/hooks/useReduceMotion";

/** How long each digit takes to move to the next one; every digit turns at this one speed. */
export const NUMERIC_TEXT_STEP_MS = 180;
/** Where a long jump stops counting out loud: the whole roll never takes longer than this. */
export const NUMERIC_TEXT_MAX_MS = 1500;

type TextProps = Omit<React.ComponentProps<typeof AppText>, "children">;

type Props = TextProps & {
  /** The number to show, as text ("12", "1,204", "–"). */
  value: string;
  /**
   * Which way the digits turn. Left out, it follows the value: lower than before turns down,
   * anything else turns up (SwiftUI's `.contentTransition(.numericText(countsDown:))`).
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

const isDigit = (char: string) => char >= "0" && char <= "9";

/**
 * The digits a column passes through on its way from one digit to another, in the order they are
 * stacked top to bottom. Counting up the column slides up through old, old+1 ... new (wrapping 9 to
 * 0); counting down it slides down, so the stack is new ... old. A change from 1 to 5 is 1, 2, 3, 4, 5.
 */
export function digitStrip(from: string, to: string, countsDown: boolean): string[] {
  const start = Number(from);
  const end = Number(to);
  const steps = countsDown ? (start - end + 10) % 10 : (end - start + 10) % 10;
  return Array.from({ length: steps + 1 }, (_, i) =>
    String((countsDown ? end + i : start + i) % 10),
  );
}

type Roll = { current: string; previous: string | null; countsDown: boolean };

/**
 * A number that changes while it is on screen (the stall count, the stamp count): the numeric-text
 * transition. Each digit that changed turns on its own, through every value in between (1 to 5
 * shows 1, 2, 3, 4, 5), upward as the number grows and downward as it counts down. Every digit
 * turns at the same speed, so a bigger jump takes longer; the digits that did not change stay still.
 * The first value just appears. Under Reduce Motion the value is swapped at once. Screen readers
 * only ever see the current value.
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

  // Line the old and new values up from the right, so units stay under units when 99 becomes 100.
  const width = Math.max(roll.current.length, roll.previous?.length ?? 0);
  const now = roll.current.padStart(width, "\0").split("");
  const was = (roll.previous ?? roll.current).padStart(width, "\0").split("");

  // One column per changed character. A digit to a digit turns through the values between; any
  // other change (a dash to a number, a digit gained or lost) fades across.
  const columns = now.map((char, index) => {
    const old = was[index];
    if (roll.previous === null || char === old) return { char, old, steps: 0, strip: null };
    if (isDigit(char) && isDigit(old)) {
      const strip = digitStrip(old, char, roll.countsDown);
      return { char, old, steps: strip.length - 1, strip };
    }
    return { char, old, steps: 1, strip: null };
  });
  const longest = Math.max(1, ...columns.map((column) => column.steps));
  const duration = Math.min(NUMERIC_TEXT_MAX_MS, longest * NUMERIC_TEXT_STEP_MS);

  useLayoutEffect(() => {
    if (roll.previous === null) return;
    progress.setValue(0);
    // Linear, so every step takes as long as the next and every digit turns at the same speed.
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) setRoll((r) => (r.current === roll.current ? { ...r, previous: null } : r));
    });
    return () => animation.stop();
  }, [duration, progress, roll.current, roll.previous]);

  // Tabular digits keep every figure the same width, so the number does not shimmy as it turns.
  const digitStyle = [...(Array.isArray(style) ? style : style ? [style] : []), TABULAR];
  const text = (children: string, key?: string, extra?: object) => (
    <AppText key={key} variant={variant} style={[...digitStyle, extra ?? {}]} {...textProps}>
      {children}
    </AppText>
  );

  if (roll.previous === null) {
    return <View style={containerStyle}>{text(roll.current)}</View>;
  }

  return (
    <View
      accessible
      accessibilityLabel={roll.current}
      style={[{ flexDirection: "row" }, containerStyle]}
    >
      {columns.map(({ char, old, steps, strip }, index) => {
        const shown = char === "\0" ? "" : char;
        if (steps === 0) return text(shown, `s${index}`);

        // This column finishes after its own share of the roll, then holds its digit.
        const share = steps / longest;
        const fraction = <T extends number | string>(from: T, to: T) =>
          progress.interpolate({
            inputRange: share < 1 ? [0, share, 1] : [0, 1],
            outputRange: (share < 1 ? [from, to, to] : [from, to]) as number[] | string[],
          });

        if (strip) {
          // A tall stack of the digits between, shown through a one-digit window. The new digit
          // sizes the window (and is hidden); the stack slides behind it, up or down, by a share of
          // its own height (so no digit height has to be measured).
          const end = `-${(steps / (steps + 1)) * 100}%`;
          return (
            <View key={`r${index}`} style={{ overflow: "hidden" }}>
              {text(shown, undefined, { opacity: 0 })}
              <Animated.View
                accessibilityElementsHidden
                aria-hidden
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
                style={{
                  left: 0,
                  position: "absolute",
                  right: 0,
                  top: 0,
                  transform: [
                    { translateY: roll.countsDown ? fraction(end, "0%") : fraction("0%", end) },
                  ],
                }}
              >
                {strip.map((digit, i) => text(digit, `d${i}`))}
              </Animated.View>
            </View>
          );
        }

        const enter = {
          opacity: fraction(0, 1),
          transform: [{ translateY: fraction(roll.countsDown ? -8 : 8, 0) }],
        };
        const leave = {
          opacity: fraction(1, 0),
          transform: [{ translateY: fraction(0, roll.countsDown ? 8 : -8) }],
        };
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
