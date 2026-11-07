import { useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReduceMotion } from "@/hooks/useReduceMotion";
import { EASE_OUT } from "@/lib/motion/uiMotion";
import { useHungryTheme } from "@/theme";

/** Drag further than this (px), or flick faster than the velocity, and the sheet closes. */
export const SHEET_DISMISS_DISTANCE = 90;
export const SHEET_DISMISS_VELOCITY = 700;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The part you grab to drag the sheet down: the handle bar, the title. */
  header: ReactNode;
  children: ReactNode;
  closeLabel?: string;
  /** Called once the sheet has finished closing and its modal is gone from the screen. */
  onClosed?: () => void;
  /** Share of the screen the sheet may fill. */
  maxHeightRatio?: number;
};

/**
 * A bottom sheet that is part of the app, not the system's: the dim fades in as the panel rises,
 * a swipe down on its header (or a tap outside) closes it, and it follows the finger while it is
 * dragged. It runs on the UI thread, so it stays smooth while the screen behind it re-renders.
 */
export function DismissibleSheet({
  visible,
  onClose,
  header,
  children,
  closeLabel = "Close",
  onClosed,
  maxHeightRatio = 0.7,
}: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const panelHeight = useSharedValue(420);
  const wasMounted = useRef(mounted);
  // The modal is gone once `mounted` flips off after having been on.
  useEffect(() => {
    if (mounted) {
      wasMounted.current = true;
      return;
    }
    if (!wasMounted.current) return;
    wasMounted.current = false;
    onClosed?.();
  }, [mounted, onClosed]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.set(0);
      progress.set(withTiming(1, { duration: reduceMotion ? 0 : 280, easing: EASE_OUT }));
      return;
    }
    progress.set(
      withTiming(
        0,
        { duration: reduceMotion ? 0 : 140, easing: Easing.out(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(setMounted)(false);
        },
      ),
    );
  }, [visible, reduceMotion]);

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      drag.set(Math.max(0, event.translationY));
    })
    .onEnd((event) => {
      if (event.translationY > SHEET_DISMISS_DISTANCE || event.velocityY > SHEET_DISMISS_VELOCITY) {
        runOnJS(onClose)();
      } else {
        drag.set(withTiming(0, { duration: 180, easing: EASE_OUT }));
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.get() * Math.max(0, 1 - drag.get() / (panelHeight.get() * 1.5)),
  }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * panelHeight.get() + drag.get() }],
  }));

  if (!mounted) return null;
  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <GestureHandlerRootView style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              backgroundColor: palette.overlay,
              bottom: 0,
              left: 0,
              position: "absolute",
              right: 0,
              top: 0,
            },
            backdropStyle,
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
        />
        <Animated.View
          onLayout={(event: LayoutChangeEvent) => panelHeight.set(event.nativeEvent.layout.height)}
          style={[
            {
              backgroundColor: palette.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              maxHeight: `${Math.round(maxHeightRatio * 100)}%`,
              paddingBottom: Math.max(insets.bottom, spacing[3]),
            },
            panelStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View>
              <View style={{ alignItems: "center", paddingTop: spacing[2] }}>
                <View
                  style={{
                    backgroundColor: palette.border,
                    borderRadius: 2,
                    height: 4,
                    width: 40,
                  }}
                />
              </View>
              {header}
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
