// useExperimentVariant in a React tree. Run with `npm run test:render`.
import assert from "node:assert/strict";
import { act, createElement } from "react";
import test, { afterEach } from "node:test";

import {
  resetExperimentSession,
  setExperimentFlagSource,
  useExperimentVariant,
  type ExperimentFlagSource,
} from "@/lib/experiments/experiments";
import { cleanup, render } from "@/test/render";

afterEach(() => {
  cleanup();
  setExperimentFlagSource(undefined);
  resetExperimentSession();
});

function fakeSource(flags: Record<string, string> | undefined) {
  const state = { flags, exposures: 0, listeners: new Set<() => void>() };
  const source: ExperimentFlagSource = {
    peek: (key) => state.flags?.[key],
    expose: (key) => {
      state.exposures += 1;
      return state.flags?.[key];
    },
    hasLoaded: () => state.flags !== undefined,
    onChange: (callback) => {
      state.listeners.add(callback);
      return () => state.listeners.delete(callback);
    },
  };
  return { state, source };
}

async function renderVariant(enabled: boolean) {
  const box = { current: "" };
  function Probe({ on }: { on: boolean }) {
    box.current = useExperimentVariant("welcome_back_v2", { enabled: on });
    return null;
  }
  const view = await render(createElement(Probe, { on: enabled }));
  return { box, rerender: (on: boolean) => view.rerender(createElement(Probe, { on })) };
}

test("an ineligible user gets the fallback and is never exposed", async () => {
  const fake = fakeSource({ welcome_back_v2: "test" });
  setExperimentFlagSource(fake.source);
  const { box } = await renderVariant(false);
  assert.equal(box.current, "control");
  assert.equal(fake.state.exposures, 0);
});

test("the variant switches in when flags load, exposing once", async () => {
  const fake = fakeSource(undefined);
  setExperimentFlagSource(fake.source);
  const { box } = await renderVariant(true);
  assert.equal(box.current, "control");
  assert.equal(fake.state.exposures, 0);

  await act(async () => {
    fake.state.flags = { welcome_back_v2: "test" };
    for (const listener of fake.state.listeners) listener();
  });
  assert.equal(box.current, "test");
  assert.equal(fake.state.exposures, 1);
});

test("becoming eligible later exposes at that moment", async () => {
  const fake = fakeSource({ welcome_back_v2: "test" });
  setExperimentFlagSource(fake.source);
  const { box, rerender } = await renderVariant(false);
  assert.equal(fake.state.exposures, 0);
  await rerender(true);
  assert.equal(box.current, "test");
  assert.equal(fake.state.exposures, 1);
});

test("unmounting unsubscribes from flag reloads", async () => {
  const fake = fakeSource({ welcome_back_v2: "control" });
  setExperimentFlagSource(fake.source);
  await renderVariant(true);
  assert.equal(fake.state.listeners.size, 1);
  cleanup();
  assert.equal(fake.state.listeners.size, 0);
});
