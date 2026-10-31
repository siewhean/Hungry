import assert from "node:assert/strict";
import test from "node:test";

import { useUIStore } from "./useUIStore";

test("persist migration drops the removed Theme and Reduce motion values and keeps the rest", () => {
  const { migrate, version } = useUIStore.persist.getOptions();
  assert.equal(version, 1);
  const migrated = migrate?.(
    {
      themePreference: "dark",
      reducedMotionEnabled: true,
      hapticFeedbackEnabled: false,
      analyticsEnabled: false,
    },
    0,
  );
  assert.deepEqual(migrated, { hapticFeedbackEnabled: false, analyticsEnabled: false });
  assert.deepEqual(migrate?.(undefined, 0), {});
});

test("only the four device settings are persisted", () => {
  const { partialize } = useUIStore.persist.getOptions();
  const saved = partialize?.(useUIStore.getState()) as Record<string, unknown>;
  assert.deepEqual(Object.keys(saved).sort(), [
    "allowSearchHistory",
    "analyticsEnabled",
    "hapticFeedbackEnabled",
    "leftHandedMode",
  ]);
});

test("device setting setters change only their own value", () => {
  const { getState } = useUIStore;
  getState().setHapticFeedbackEnabled(false);
  getState().setAllowSearchHistory(false);
  getState().setLeftHandedMode(true);
  getState().setThemePreference("dark");
  getState().setReducedMotionEnabled(true);
  const state = getState();
  assert.equal(state.hapticFeedbackEnabled, false);
  assert.equal(state.allowSearchHistory, false);
  assert.equal(state.leftHandedMode, true);
  assert.equal(state.themePreference, "dark");
  assert.equal(state.reducedMotionEnabled, true);
  getState().setHapticFeedbackEnabled(true);
  getState().setAllowSearchHistory(true);
  getState().setLeftHandedMode(false);
  getState().setThemePreference("system");
  getState().setReducedMotionEnabled(false);
});

test("scroll tracking collapses the header going down and shows scroll-back going up", () => {
  const { getState } = useUIStore;
  getState().registerScrollForBack(400);
  assert.equal(getState().isHeaderCollapsed, true);
  getState().registerScrollForBack(350);
  assert.equal(getState().scrollBackVisible, true);
  getState().resetScrollBack();
  assert.equal(getState().scrollBackVisible, false);
});

test("sign-in prompt keeps one pending action that runs at most once", () => {
  const { getState } = useUIStore;
  const action = () => undefined;
  getState().openSignInPrompt({ title: "Sign in to save" }, action);
  assert.equal(getState().takePendingAuthAction(), action);
  assert.equal(getState().takePendingAuthAction(), null);
  getState().closeSignInPrompt();
  assert.equal(getState().signInPrompt, null);
});

test("held Food Cred points replay once when released with show", () => {
  const { getState } = useUIStore;
  getState().addHeldCredPoints(5);
  assert.equal(getState().credHold, null);
  getState().holdCredToast();
  getState().addHeldCredPoints(5);
  getState().addHeldCredPoints(3);
  getState().releaseCredToast(true);
  assert.deepEqual(getState().credReplay, { id: 1, points: 8 });
  assert.equal(getState().credHold, null);
  getState().releaseCredToast(false);
  getState().holdCredToast();
  getState().releaseCredToast(false);
  assert.equal(getState().credReplay?.id, 1);
});
