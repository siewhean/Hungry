import { useCallback, useEffect, useRef } from "react";
import {
  Keyboard,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from "react-native";

// Room kept visible under the focused field: the next field or the primary action.
export const KEYBOARD_REVEAL_BELOW_FOCUSED = 136;
const KEYBOARD_REVEAL_TOP_MARGIN = 16;
const KEYBOARD_REVEAL_DELAY_MS = 50;

/**
 * Pure scroll math, exported for tests. Returns how far to scroll down so the
 * focused field plus `revealBelow` sits above the keyboard, without pushing the
 * field above the scroll viewport's top edge. 0 means no scroll is needed.
 */
export function computeKeyboardRevealShift(input: {
  keyboardTop: number;
  scrollTop: number;
  inputTop: number;
  inputHeight: number;
  revealBelow?: number;
}): number {
  const revealBelow = input.revealBelow ?? KEYBOARD_REVEAL_BELOW_FOCUSED;
  const overlap = input.inputTop + input.inputHeight + revealBelow - input.keyboardTop;
  if (overlap <= 0) return 0;
  const maxShift = input.inputTop - (input.scrollTop + KEYBOARD_REVEAL_TOP_MARGIN);
  return Math.max(0, Math.min(overlap, maxShift));
}

/**
 * KeyboardAvoidingView only shrinks the viewport; a ScrollView never scrolls a
 * focused TextInput into view by itself. Wire the returned props onto the form's
 * ScrollView (and `onFocus` onto a wrapper View — TextInput focus bubbles) so the
 * focused field and the control below it stay above the keyboard.
 */
export function useKeyboardRevealFocusedInput() {
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetY = useRef(0);
  const keyboardTopY = useRef<number | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealFocusedInput = useCallback(() => {
    const keyboardTop = keyboardTopY.current;
    // No keyboard (e.g. web, where Keyboard events never fire): nothing to reveal.
    if (keyboardTop === null) return;
    const scrollView = scrollRef.current;
    const scrollHost = scrollView?.getNativeScrollRef?.();
    // react-native-web's TextInput.State has no currentlyFocusedInput().
    const getFocused = TextInput.State?.currentlyFocusedInput;
    const focused = typeof getFocused === "function" ? getFocused() : null;
    if (!scrollView || !scrollHost || !focused) return;
    scrollHost.measureInWindow((_scrollX, scrollTop) => {
      focused.measureInWindow((_x, inputTop, _width, inputHeight) => {
        const shift = computeKeyboardRevealShift({ keyboardTop, scrollTop, inputTop, inputHeight });
        if (shift <= 0) return;
        scrollView.scrollTo({ y: scrollOffsetY.current + shift, animated: true });
      });
    });
  }, []);

  const onFocus = useCallback(() => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    // Let KeyboardAvoidingView apply its padding before measuring.
    revealTimer.current = setTimeout(revealFocusedInput, KEYBOARD_REVEAL_DELAY_MS);
  }, [revealFocusedInput]);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      keyboardTopY.current = event.endCoordinates.screenY;
      onFocus();
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      keyboardTopY.current = null;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, [onFocus]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetY.current = event.nativeEvent.contentOffset.y;
  }, []);

  return { scrollRef, onScroll, onFocus, scrollEventThrottle: 16 } as const;
}
