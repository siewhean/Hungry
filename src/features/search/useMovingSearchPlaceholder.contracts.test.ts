import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hookSource = readFileSync("src/features/search/useMovingSearchPlaceholder.ts", "utf8");

test("moving search placeholder uses a step state machine instead of elapsed-time frames", () => {
  assert.doesNotMatch(hookSource, /cycleStartRef = useRef\(Date\.now\(\)\)/);
  assert.doesNotMatch(hookSource, /requestAnimationFrame/);
  assert.match(
    hookSource,
    /type PlaceholderAnimationPhase = "revealing" \| "holding" \| "slidingLeft" \| "gap"/,
  );
  assert.match(hookSource, /timeoutRef\.current = setTimeout\(step, delayMs\)/);
});

test("moving search placeholder reveals exactly one letter per step", () => {
  assert.match(hookSource, /visibleText\.length \+ 1/);
  assert.match(hookSource, /phrase\.slice\(0, nextVisibleCount\)/);
});

test("moving search placeholder slides left by removing from the front on refresh", () => {
  assert.match(hookSource, /animationPhaseRef\.current === "slidingLeft"/);
  assert.match(hookSource, /const nextVisibleText = visibleText\.slice\(1\)/);
});

test("moving search placeholder enforces readable pacing even when callers pass fast timings", () => {
  assert.match(hookSource, /const MIN_CYCLE_MS = 6_000/);
  assert.match(hookSource, /const MIN_PAUSE_MS = 1_200/);
  assert.match(hookSource, /const MIN_REVEAL_STEP_MS = 88/);
  assert.match(hookSource, /const MIN_SLIDE_STEP_MS = 32/);
  assert.match(hookSource, /Math\.max\(MIN_CYCLE_MS, totalCycleMs\)/);
});

test("moving search placeholder disables animation for screen reader and reduced motion users", () => {
  assert.match(hookSource, /AccessibilityInfo\.isScreenReaderEnabled/);
  assert.match(hookSource, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(hookSource, /screenReaderChanged/);
  assert.match(hookSource, /reduceMotionChanged/);
  assert.match(
    hookSource,
    /const canAnimate = enabled && !isScreenReaderEnabled && !reduceMotionEnabled/,
  );
  assert.match(hookSource, /if \(!canAnimate \|\| normalizedPhrases\.length === 0\)/);
});
