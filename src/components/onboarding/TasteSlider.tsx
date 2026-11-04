import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, View, type LayoutChangeEvent } from "react-native";

import { AppText } from "@/components/ui";
import { crossedStop, valueFromX, xFromValue } from "@/features/onboarding/sliderGeometry";
import {
  MAX_SLIDER_VALUE,
  STOP_VALUES,
  formatSliderValue,
  snapToStop,
} from "@/features/onboarding/tasteSliderStops";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { selectHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

const THUMB = 32;
const TRACK_HEIGHT = 6;
const INSET = THUMB / 2;
const HIT_HEIGHT = 72;
const SETTLE_MS = 180;

type Props = {
  /** The settled value (one of the five stops). */
  value: number;
  /** Fires on every move with the free value, so the picture can follow the thumb. */
  onMove: (value: number) => void;
  /** Fires when the finger lifts (or a stop is tapped): the value has snapped to a stop. */
  onSettle: (value: number) => void;
  accessibilityLabel: string;
  /** Spoken value, for example "7.5, Hot, Sambal stingray". */
  accessibilityValueText: string;
  /** The text in the bubble above the thumb. Default: the number, "6.3" while dragging. */
  bubbleLabel?: (value: number, settled: boolean) => string;
  /** Not set yet: the thumb rests at the middle and the bubble is dimmed. */
  unset?: boolean;
};

/**
 * A smooth slider: the thumb follows the finger freely and only snaps to the nearest of five stops
 * when the finger lifts. A light tick plays each time the thumb crosses into another stop.
 */
export function TasteSlider({
  value,
  onMove,
  onSettle,
  accessibilityLabel,
  accessibilityValueText,
  bubbleLabel = formatSliderValue,
  unset = false,
}: Props) {
  const { palette, radii } = useHungryTheme();
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [shown, setShown] = useState(value);
  const position = useRef(new Animated.Value(value)).current;
  const live = useRef(value);
  const widthRef = useRef(0);
  const callbacks = useRef({ onMove, onSettle });
  callbacks.current = { onMove, onSettle };

  const moveTo = useCallback(
    (next: number) => {
      if (crossedStop(live.current, next)) selectHaptic();
      live.current = next;
      position.setValue(next);
      setShown(next);
      callbacks.current.onMove(next);
    },
    [position],
  );

  const settle = useCallback(() => {
    const snapped = snapToStop(live.current);
    setDragging(false);
    live.current = snapped;
    setShown(snapped);
    callbacks.current.onMove(snapped);
    callbacks.current.onSettle(snapped);
    if (reduceMotion) {
      position.setValue(snapped);
      return;
    }
    Animated.timing(position, {
      toValue: snapped,
      duration: SETTLE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [position, reduceMotion]);

  // A value set from outside (Back, Skip, accessibility step) moves the thumb without a drag.
  useEffect(() => {
    if (dragging || live.current === value) return;
    live.current = value;
    setShown(value);
    position.setValue(value);
  }, [value, dragging, position]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          setDragging(true);
          moveTo(valueFromX(event.nativeEvent.locationX, widthRef.current, INSET));
        },
        // The children ignore touches, so locationX is always measured on the slider itself.
        onPanResponderMove: (event) => {
          moveTo(valueFromX(event.nativeEvent.locationX, widthRef.current, INSET));
        },
        onPanResponderRelease: settle,
        onPanResponderTerminate: settle,
      }),
    [moveTo, settle],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    widthRef.current = event.nativeEvent.layout.width;
    setWidth(event.nativeEvent.layout.width);
  };

  const step = (direction: 1 | -1) => {
    const index = STOP_VALUES.indexOf(snapToStop(live.current) as (typeof STOP_VALUES)[number]);
    const next = STOP_VALUES[Math.max(0, Math.min(STOP_VALUES.length - 1, index + direction))]!;
    live.current = next;
    position.setValue(next);
    setShown(next);
    callbacks.current.onMove(next);
    callbacks.current.onSettle(next);
  };

  const thumbLeft = position.interpolate({
    inputRange: [0, MAX_SLIDER_VALUE],
    outputRange: [INSET - THUMB / 2, Math.max(INSET, width - INSET) - THUMB / 2],
    extrapolate: "clamp",
  });

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: accessibilityValueText }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") step(1);
        if (event.nativeEvent.actionName === "decrement") step(-1);
      }}
      onLayout={onLayout}
      style={{ height: HIT_HEIGHT, justifyContent: "center" }}
      {...responder.panHandlers}
    >
      <View
        pointerEvents="none"
        style={{
          backgroundColor: palette.border,
          borderRadius: radii.pill,
          height: TRACK_HEIGHT,
          marginHorizontal: INSET,
        }}
      />
      {STOP_VALUES.map((stop) => (
        <View
          key={stop}
          pointerEvents="none"
          style={{
            backgroundColor: palette.textMuted,
            borderRadius: radii.pill,
            height: 10,
            left: xFromValue(stop, width, INSET) - 5,
            position: "absolute",
            top: HIT_HEIGHT / 2 - 5,
            width: 10,
          }}
        />
      ))}
      <Animated.View
        pointerEvents="none"
        style={{
          alignItems: "center",
          left: thumbLeft,
          position: "absolute",
          top: 0,
          width: THUMB,
        }}
      >
        <AppText
          variant="micro"
          style={{ color: unset ? palette.textMuted : palette.orange, height: 18 }}
        >
          {unset ? "–" : bubbleLabel(shown, !dragging)}
        </AppText>
        <View
          style={{
            backgroundColor: unset ? palette.surface : palette.orange,
            borderColor: palette.orange,
            borderRadius: radii.pill,
            borderWidth: 3,
            height: THUMB,
            marginTop: HIT_HEIGHT / 2 - 18 - THUMB / 2,
            width: THUMB,
          }}
        />
      </Animated.View>
    </View>
  );
}
