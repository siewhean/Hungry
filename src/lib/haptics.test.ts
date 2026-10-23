import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./haptics.ts", import.meta.url), "utf8");

test("every haptic goes through the Settings switch", () => {
  assert.match(source, /if \(!isHapticFeedbackEnabled\(\)\) return;/);
  assert.equal((source.match(/from "expo-haptics"/g) ?? []).length, 1);
});

test("the semantic helpers are gentle: light, soft or selection, with success only for milestones", () => {
  for (const name of [
    "tapHaptic",
    "selectHaptic",
    "confirmHaptic",
    "successHaptic",
    "warnHaptic",
  ]) {
    assert.match(source, new RegExp(`export function ${name}\\(`));
  }
  assert.match(source, /tapHaptic[\s\S]*ImpactFeedbackStyle\.Light/);
  assert.match(source, /confirmHaptic[\s\S]*ImpactFeedbackStyle\.Soft/);
  assert.doesNotMatch(
    source.split("// Semantic helpers")[1] ?? "",
    /ImpactFeedbackStyle\.(Heavy|Rigid|Medium)/,
  );
});

test("rapid taps are throttled so haptics never stack", () => {
  assert.match(source, /const MIN_GAP_MS = 80;/);
  assert.match(source, /if \(now - lastHapticAt < MIN_GAP_MS\) return false;/);
});
