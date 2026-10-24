import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { afterEach } from "node:test";

import {
  EXPERIMENTS,
  clearExperimentOverrides,
  getExperimentVariant,
  resetExperimentSession,
  resolveExperimentVariant,
  setExperimentFlagSource,
  setExperimentOverride,
  type ExperimentDefinition,
  type ExperimentFlagSource,
  type ExperimentKey,
} from "./experiments";

const KEYS = Object.keys(EXPERIMENTS) as ExperimentKey[];

function fakeSource(initial: Record<string, boolean | string> | undefined) {
  const state = { flags: initial, exposures: [] as string[], listeners: new Set<() => void>() };
  const source: ExperimentFlagSource = {
    peek: (key) => state.flags?.[key],
    expose: (key) => {
      state.exposures.push(key);
      return state.flags?.[key];
    },
    hasLoaded: () => state.flags !== undefined,
    onChange: (callback) => {
      state.listeners.add(callback);
      return () => state.listeners.delete(callback);
    },
  };
  return {
    state,
    source,
    load(flags: Record<string, boolean | string>) {
      state.flags = flags;
      for (const listener of state.listeners) listener();
    },
  };
}

afterEach(() => {
  setExperimentFlagSource(undefined);
  clearExperimentOverrides();
  resetExperimentSession();
  delete process.env.EXPO_PUBLIC_DISABLE_EXPERIMENTS;
});

test("flag values map to known variants, with the fallback otherwise", () => {
  assert.equal(resolveExperimentVariant("welcome_back_v1", "control"), "control");
  assert.equal(resolveExperimentVariant("welcome_back_v1", "test"), "test");
  assert.equal(resolveExperimentVariant("welcome_back_v1", true), "test");
  assert.equal(resolveExperimentVariant("welcome_back_v1", false), "control");
  assert.equal(resolveExperimentVariant("welcome_back_v1", "unknown"), "test");
  assert.equal(resolveExperimentVariant("welcome_back_v1", ""), "test");
  assert.equal(resolveExperimentVariant("welcome_back_v1", undefined), "test");
});

test("without PostHog every experiment uses its fallback", () => {
  for (const key of KEYS) {
    assert.equal(getExperimentVariant(key), EXPERIMENTS[key].fallback);
    assert.equal(getExperimentVariant(key, { expose: true }), EXPERIMENTS[key].fallback);
  }
});

test("every experiment is well formed", () => {
  const analyticsTypes = fs.readFileSync(
    path.join(process.cwd(), "src/lib/analytics/types.ts"),
    "utf8",
  );
  for (const key of KEYS) {
    const definition = EXPERIMENTS[key] as ExperimentDefinition;
    assert.match(key, /^[a-z][a-z0-9_]*_v\d+$/, `${key}: keys are snake_case with a _vN suffix`);
    assert.ok(definition.variants.length >= 2, `${key}: needs at least two variants`);
    assert.equal(new Set(definition.variants).size, definition.variants.length, `${key}: duplicate variants`);
    assert.ok(definition.variants.includes("control"), `${key}: needs a control variant`);
    assert.ok(definition.variants.includes(definition.fallback), `${key}: fallback must be a variant`);
    assert.ok(definition.hypothesis.length > 20, `${key}: write the hypothesis`);
    assert.ok(definition.surface.length > 0, `${key}: name the surface`);
    for (const metric of [definition.primaryMetric, ...definition.guardrailMetrics]) {
      assert.ok(analyticsTypes.includes(`"${metric}"`), `${key}: metric ${metric} is not an analytics event`);
    }
    assert.ok(!definition.guardrailMetrics.includes(definition.primaryMetric), `${key}: guardrail repeats primary`);
  }
});

test("every experiment key is read somewhere in the app", () => {
  const sources: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !full.includes("experiments.ts")) {
        sources.push(fs.readFileSync(full, "utf8"));
      }
    }
  };
  walk(path.join(process.cwd(), "src"));
  const all = sources.join("\n");
  for (const key of KEYS) {
    assert.ok(all.includes(`"${key}"`), `${key} is registered but no screen reads it`);
  }
});

test("reading without expose never records exposure", () => {
  const fake = fakeSource({ welcome_back_v1: "control" });
  setExperimentFlagSource(fake.source);
  assert.equal(getExperimentVariant("welcome_back_v1"), "control");
  assert.deepEqual(fake.state.exposures, []);
});

test("exposure waits for flags to load, then records once and freezes the variant", () => {
  const fake = fakeSource(undefined);
  setExperimentFlagSource(fake.source);

  assert.equal(getExperimentVariant("welcome_back_v1", { expose: true }), "test");
  assert.deepEqual(fake.state.exposures, [], "no exposure before flags load");

  fake.load({ welcome_back_v1: "control" });
  assert.equal(getExperimentVariant("welcome_back_v1", { expose: true }), "control");
  assert.deepEqual(fake.state.exposures, ["welcome_back_v1"]);

  // A later reload that changes the assignment does not switch the UI mid-session.
  fake.load({ welcome_back_v1: "test" });
  assert.equal(getExperimentVariant("welcome_back_v1", { expose: true }), "control");
  assert.deepEqual(fake.state.exposures, ["welcome_back_v1"], "frozen reads do not re-expose");
});

test("resetting the session (sign-out) unfreezes the variant", () => {
  const fake = fakeSource({ welcome_back_v1: "control" });
  setExperimentFlagSource(fake.source);
  assert.equal(getExperimentVariant("welcome_back_v1", { expose: true }), "control");
  fake.load({ welcome_back_v1: "test" });
  resetExperimentSession();
  assert.equal(getExperimentVariant("welcome_back_v1", { expose: true }), "test");
  assert.equal(fake.state.exposures.length, 2);
});

test("the kill switch forces every fallback and records no exposure", () => {
  const fake = fakeSource(Object.fromEntries(KEYS.map((key) => [key, "control"])));
  setExperimentFlagSource(fake.source);
  process.env.EXPO_PUBLIC_DISABLE_EXPERIMENTS = "1";
  for (const key of KEYS) {
    assert.equal(getExperimentVariant(key, { expose: true }), EXPERIMENTS[key].fallback);
  }
  assert.deepEqual(fake.state.exposures, []);
});

test("QA overrides win outside production and are ignored in production", () => {
  const fake = fakeSource({ welcome_back_v1: "test" });
  setExperimentFlagSource(fake.source);
  setExperimentOverride("welcome_back_v1", "control");
  assert.equal(getExperimentVariant("welcome_back_v1", { expose: true }), "control");
  assert.deepEqual(fake.state.exposures, [], "an override is not a real exposure");
  setExperimentOverride("welcome_back_v1", null);
  assert.equal(getExperimentVariant("welcome_back_v1", { expose: true }), "test");

  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    resetExperimentSession();
    setExperimentOverride("welcome_back_v1", "control");
    assert.equal(getExperimentVariant("welcome_back_v1", { expose: true }), "test");
  } finally {
    process.env.NODE_ENV = previous;
  }
});

test("a boolean flag maps to test/control and unknown variants fall back", () => {
  const fake = fakeSource({ welcome_back_v1: false });
  setExperimentFlagSource(fake.source);
  assert.equal(getExperimentVariant("welcome_back_v1", { expose: true }), "control");
  resetExperimentSession();
  fake.load({ welcome_back_v1: "variant-from-a-typo" });
  assert.equal(getExperimentVariant("welcome_back_v1", { expose: true }), "test");
});
