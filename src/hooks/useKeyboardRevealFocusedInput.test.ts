import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as React from "react";
import { Keyboard, TextInput } from "react-native";

import {
  computeKeyboardRevealShift,
  KEYBOARD_REVEAL_BELOW_FOCUSED,
  useKeyboardRevealFocusedInput,
} from "./useKeyboardRevealFocusedInput";

// iPhone 17 Pro-ish: 874pt window, keyboard (with Passwords bar) top at ~530pt.
const KEYBOARD_TOP = 530;

test("password field just above the keyboard scrolls so the button below is revealed", () => {
  const shift = computeKeyboardRevealShift({
    keyboardTop: KEYBOARD_TOP,
    scrollTop: 59,
    inputTop: 470,
    inputHeight: 52,
  });
  assert.equal(shift, 470 + 52 + KEYBOARD_REVEAL_BELOW_FOCUSED - KEYBOARD_TOP);
});

test("no scroll when the field and the space below it are already visible", () => {
  assert.equal(
    computeKeyboardRevealShift({
      keyboardTop: KEYBOARD_TOP,
      scrollTop: 59,
      inputTop: 200,
      inputHeight: 52,
    }),
    0,
  );
});

test("never scrolls the focused field above the viewport top", () => {
  const shift = computeKeyboardRevealShift({
    keyboardTop: 150,
    scrollTop: 59,
    inputTop: 120,
    inputHeight: 52,
  });
  assert.equal(shift, 120 - (59 + 16));
});

test("auth forms wire the reveal hook onto their ScrollView", () => {
  for (const file of [
    "src/app/screens/auth/AuthScreenShell.tsx",
    "src/app/screens/onboarding/OnboardingAuthScreen.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /behavior=\{Platform\.OS === "ios" \? "padding" : undefined\}/, file);
    assert.match(source, /ref=\{keyboardReveal\.scrollRef\}/, file);
    assert.match(source, /onScroll=\{keyboardReveal\.onScroll\}/, file);
    assert.match(source, /onFocus=\{keyboardReveal\.onFocus\}/, file);
  }
});

// Runs a hook once with a small stand-in for React's dispatcher (refs, callbacks, effects), so the
// hook's own logic is exercised without a renderer. The render suite covers it mounted.
function runHookOnce<T>(callHook: () => T) {
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const effects: (() => void | (() => void))[] = [];
  const previous = internals.H;
  internals.H = {
    useRef: (initial: unknown) => ({ current: initial }),
    useCallback: (fn: unknown) => fn,
    useEffect: (effect: () => void | (() => void)) => void effects.push(effect),
  };
  let value: T;
  try {
    value = callHook();
  } finally {
    internals.H = previous;
  }
  const cleanups = effects.map((effect) => effect());
  return {
    value,
    unmount: () =>
      cleanups.forEach((cleanup) => (typeof cleanup === "function" ? cleanup() : undefined)),
  };
}

type Listener = (event: { endCoordinates: { screenY: number } }) => void;
// The stub's Keyboard and TextInput are plain objects; the real types are read-only.
const keyboard = Keyboard as unknown as { addListener: unknown };
const textInput = TextInput as unknown as { State: unknown };

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("the hook scrolls a covered field above the keyboard once the keyboard shows", async () => {
  const listeners: Record<string, (event: { endCoordinates: { screenY: number } }) => void> = {};
  const removed: string[] = [];
  const originalAdd = keyboard.addListener;
  const originalState = textInput.State;
  keyboard.addListener = (name: string, listener: Listener) => {
    listeners[name] = listener;
    return { remove: () => void removed.push(name) };
  };
  textInput.State = {
    currentlyFocusedInput: () => ({
      measureInWindow: (done: (x: number, y: number, w: number, h: number) => void) =>
        done(0, 470, 300, 52),
    }),
  };
  const scrolls: { y: number; animated: boolean }[] = [];
  try {
    const { value, unmount } = runHookOnce(() => useKeyboardRevealFocusedInput());
    (value.scrollRef as unknown as { current: unknown }).current = {
      getNativeScrollRef: () => ({
        measureInWindow: (done: (x: number, y: number) => void) => done(0, 59),
      }),
      scrollTo: (options: { y: number; animated: boolean }) => void scrolls.push(options),
    };

    value.onScroll({ nativeEvent: { contentOffset: { y: 40 } } } as never);
    listeners.keyboardDidShow({ endCoordinates: { screenY: 530 } });
    await pause(90);
    assert.deepEqual(scrolls, [
      { y: 40 + (470 + 52 + KEYBOARD_REVEAL_BELOW_FOCUSED - 530), animated: true },
    ]);

    listeners.keyboardDidHide({ endCoordinates: { screenY: 0 } });
    value.onFocus();
    await pause(90);
    assert.equal(scrolls.length, 1, "nothing is revealed once the keyboard is gone");

    unmount();
    assert.deepEqual(removed.sort(), ["keyboardDidHide", "keyboardDidShow"]);
  } finally {
    keyboard.addListener = originalAdd;
    textInput.State = originalState;
  }
});

test("the hook does nothing when no input is focused or the field is already visible", async () => {
  const listeners: Record<string, (event: { endCoordinates: { screenY: number } }) => void> = {};
  const originalAdd = keyboard.addListener;
  const originalState = textInput.State;
  keyboard.addListener = (name: string, listener: Listener) => {
    listeners[name] = listener;
    return { remove: () => {} };
  };
  const scrolls: unknown[] = [];
  const attach = (scrollRef: { current: unknown }) => {
    scrollRef.current = {
      getNativeScrollRef: () => ({
        measureInWindow: (done: (x: number, y: number) => void) => done(0, 59),
      }),
      scrollTo: (options: unknown) => void scrolls.push(options),
    };
  };
  try {
    textInput.State = { currentlyFocusedInput: () => null };
    const noFocus = runHookOnce(() => useKeyboardRevealFocusedInput());
    attach(noFocus.value.scrollRef as unknown as { current: unknown });
    listeners.keyboardDidShow({ endCoordinates: { screenY: 130 } });
    await pause(90);

    textInput.State = {
      currentlyFocusedInput: () => ({
        measureInWindow: (done: (x: number, y: number, w: number, h: number) => void) =>
          done(0, 100, 300, 52),
      }),
    };
    const visible = runHookOnce(() => useKeyboardRevealFocusedInput());
    attach(visible.value.scrollRef as unknown as { current: unknown });
    listeners.keyboardDidShow({ endCoordinates: { screenY: 530 } });
    await pause(90);
    assert.deepEqual(scrolls, []);
    noFocus.unmount();
    visible.unmount();
  } finally {
    keyboard.addListener = originalAdd;
    textInput.State = originalState;
  }
});
