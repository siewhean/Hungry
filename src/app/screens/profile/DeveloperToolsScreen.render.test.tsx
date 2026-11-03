// The hidden Developer tools: unlock from Settings, preview an experiment variant, send a test
// error, show the crash screen. Run with
// `node scripts/test-render.mjs src/app/screens/profile/DeveloperToolsScreen.render.test.tsx`.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { DeveloperToolsScreen } from "@/app/screens/profile/DeveloperToolsScreen";
import { SettingsScreen } from "@/app/screens/profile/SettingsScreen";
import {
  EXPERIMENTS,
  clearExperimentOverrides,
  getExperimentVariant,
  setReleaseExperimentOverrides,
  type ExperimentKey,
} from "@/lib/experiments/experiments";
import { useDeveloperToolsStore } from "@/store/useDeveloperToolsStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

beforeEach(async () => {
  await enterScenario("user");
  useDeveloperToolsStore.getState().lock();
});

afterEach(async () => {
  await cleanup();
  setReleaseExperimentOverrides(false);
  clearExperimentOverrides();
  useDeveloperToolsStore.getState().lock();
});

const firstExperiment = Object.keys(EXPERIMENTS)[0] as ExperimentKey;

test("Settings hides Developer tools until Version is tapped seven times", async () => {
  const view = await renderScreen(SettingsScreen as never, { name: "Settings" });
  assert.equal(view.findByText("Developer tools"), null);
  for (let tap = 0; tap < 7; tap += 1) await view.press(view.findByLabel("Version"));
  await view.settle();
  assert.equal(useDeveloperToolsStore.getState().unlocked, true);
  assert.equal(useUIStore.getState().toast?.message, "Developer tools unlocked.");
  assert.ok(view.findByText("Developer tools"));
});

test("the screen lists the build, every experiment and the feature switches", async () => {
  const view = await renderScreen(DeveloperToolsScreen as never, { name: "DeveloperTools" });
  assert.ok(view.findByText("Developer tools"));
  assert.ok(view.findByText("App environment"));
  assert.ok(view.findByText("Supabase host"));
  for (const key of Object.keys(EXPERIMENTS)) {
    assert.ok(view.findByTestId(`dev-experiment-${key}`), `${key} is listed`);
  }
});

test("forcing a variant changes what the experiment resolves to, and Automatic clears it", async () => {
  const definition = EXPERIMENTS[firstExperiment];
  const forced = definition.variants.find((variant) => variant !== definition.fallback);
  assert.ok(forced, "the first experiment has a variant other than its fallback");
  const view = await renderScreen(DeveloperToolsScreen as never, { name: "DeveloperTools" });

  await view.press(view.findByLabel(`${firstExperiment}: ${forced}`));
  assert.equal(getExperimentVariant(firstExperiment), forced);

  await view.press(view.findByLabel(`${firstExperiment}: automatic`));
  assert.equal(getExperimentVariant(firstExperiment), definition.fallback);
});

test("the test error row reports to error tracking and tells the user", async () => {
  const view = await renderScreen(DeveloperToolsScreen as never, { name: "DeveloperTools" });
  await view.press(view.findByLabel("Send test error to Sentry"));
  assert.ok(useUIStore.getState().toast?.message);
});

test("Show crash screen swaps in the failure state instead of crashing the screen", async () => {
  const view = await renderScreen(DeveloperToolsScreen as never, { name: "DeveloperTools" });
  const originalError = console.error;
  console.error = () => undefined;
  try {
    await view.press(view.findByLabel("Show crash screen"));
    assert.ok(view.findByText("Test crash"));
  } finally {
    console.error = originalError;
  }
});
