import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  computeKeyboardRevealShift,
  KEYBOARD_REVEAL_BELOW_FOCUSED,
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
