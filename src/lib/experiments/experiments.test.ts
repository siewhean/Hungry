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
  assert.equal(resolveExperimentVariant("welcome_back_v2", "control"), "control");
  assert.equal(resolveExperimentVariant("welcome_back_v2", "test"), "test");
  assert.equal(resolveExperimentVariant("welcome_back_v2", true), "test");
  assert.equal(resolveExperimentVariant("welcome_back_v2", false), "control");
  assert.equal(resolveExperimentVariant("welcome_back_v2", "unknown"), "control");
  assert.equal(resolveExperimentVariant("welcome_back_v2", ""), "control");
  assert.equal(resolveExperimentVariant("welcome_back_v2", undefined), "control");
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
    assert.equal(
      new Set(definition.variants).size,
      definition.variants.length,
      `${key}: duplicate variants`,
    );
    assert.ok(definition.variants.includes("control"), `${key}: needs a control variant`);
    assert.ok(
      definition.variants.includes(definition.fallback),
      `${key}: fallback must be a variant`,
    );
    assert.ok(definition.hypothesis.length > 20, `${key}: write the hypothesis`);
    assert.ok(definition.surface.length > 0, `${key}: name the surface`);
    for (const metric of [definition.primaryMetric, ...definition.guardrailMetrics]) {
      assert.ok(
        analyticsTypes.includes(`"${metric}"`),
        `${key}: metric ${metric} is not an analytics event`,
      );
    }
    assert.ok(
      !definition.guardrailMetrics.includes(definition.primaryMetric),
      `${key}: guardrail repeats primary`,
    );
  }
});

test("every live experiment key is read somewhere in the app", () => {
  const sources: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (
        /\.tsx?$/.test(entry.name) &&
        !/\.test\.tsx?$/.test(entry.name) &&
        !full.includes("experiments.ts")
      ) {
        sources.push(fs.readFileSync(full, "utf8"));
      }
    }
  };
  walk(path.join(process.cwd(), "src"));
  const all = sources.join("\n");
  // A concluded experiment stays registered as a record but is no longer read. A draft whose
  // screen is not built yet may be defined first; this list only shrinks.
  const UNWIRED_DRAFTS: readonly string[] = ["auth_signup_name_later_v1"];
  for (const key of KEYS.filter(
    (k) =>
      (EXPERIMENTS[k] as ExperimentDefinition).status !== "concluded" &&
      !UNWIRED_DRAFTS.includes(k),
  )) {
    assert.ok(all.includes(`"${key}"`), `${key} is registered but no screen reads it`);
  }
});

test("reading without expose never records exposure", () => {
  const fake = fakeSource({ welcome_back_v2: "control" });
  setExperimentFlagSource(fake.source);
  assert.equal(getExperimentVariant("welcome_back_v2"), "control");
  assert.deepEqual(fake.state.exposures, []);
});

test("exposure waits for flags to load, then records once and freezes the variant", () => {
  const fake = fakeSource(undefined);
  setExperimentFlagSource(fake.source);

  assert.equal(getExperimentVariant("welcome_back_v2", { expose: true }), "control");
  assert.deepEqual(fake.state.exposures, [], "no exposure before flags load");

  fake.load({ welcome_back_v2: "test" });
  assert.equal(getExperimentVariant("welcome_back_v2", { expose: true }), "test");
  assert.deepEqual(fake.state.exposures, ["welcome_back_v2"]);

  // A later reload that changes the assignment does not switch the UI mid-session.
  fake.load({ welcome_back_v2: "control" });
  assert.equal(getExperimentVariant("welcome_back_v2", { expose: true }), "test");
  assert.deepEqual(fake.state.exposures, ["welcome_back_v2"], "frozen reads do not re-expose");
});

test("resetting the session (sign-out) unfreezes the variant", () => {
  const fake = fakeSource({ welcome_back_v2: "control" });
  setExperimentFlagSource(fake.source);
  assert.equal(getExperimentVariant("welcome_back_v2", { expose: true }), "control");
  fake.load({ welcome_back_v2: "test" });
  resetExperimentSession();
  assert.equal(getExperimentVariant("welcome_back_v2", { expose: true }), "test");
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
  const fake = fakeSource({ welcome_back_v2: "test" });
  setExperimentFlagSource(fake.source);
  setExperimentOverride("welcome_back_v2", "control");
  assert.equal(getExperimentVariant("welcome_back_v2", { expose: true }), "control");
  assert.deepEqual(fake.state.exposures, [], "an override is not a real exposure");
  setExperimentOverride("welcome_back_v2", null);
  assert.equal(getExperimentVariant("welcome_back_v2", { expose: true }), "test");

  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    resetExperimentSession();
    setExperimentOverride("welcome_back_v2", "control");
    assert.equal(getExperimentVariant("welcome_back_v2", { expose: true }), "test");
  } finally {
    process.env.NODE_ENV = previous;
  }
});

test("a boolean flag maps to test/control and unknown variants fall back", () => {
  const fake = fakeSource({ welcome_back_v2: false });
  setExperimentFlagSource(fake.source);
  assert.equal(getExperimentVariant("welcome_back_v2", { expose: true }), "control");
  resetExperimentSession();
  fake.load({ welcome_back_v2: "variant-from-a-typo" });
  assert.equal(getExperimentVariant("welcome_back_v2", { expose: true }), "control");
});

test("a concluded experiment always serves its fallback and records no exposure", () => {
  const fake = fakeSource({ welcome_back_v1: "control" });
  setExperimentFlagSource(fake.source);
  assert.equal(EXPERIMENTS.welcome_back_v1.status, "concluded");
  assert.equal(getExperimentVariant("welcome_back_v1", { expose: true }), "test");
  assert.deepEqual(fake.state.exposures, []);
});

test("a draft experiment never reads PostHog, but QA can preview its variants", () => {
  const draft = (Object.keys(EXPERIMENTS) as ExperimentKey[]).find(
    (key) => (EXPERIMENTS[key] as ExperimentDefinition).status === "draft",
  );
  if (!draft) return;
  const definition = EXPERIMENTS[draft] as ExperimentDefinition;
  const other = definition.variants.find((variant) => variant !== definition.fallback)!;
  const fake = fakeSource({ [draft]: other });
  setExperimentFlagSource(fake.source);
  assert.equal(getExperimentVariant(draft, { expose: true }), definition.fallback);
  assert.deepEqual(fake.state.exposures, []);
  setExperimentOverride(draft, other as never);
  assert.equal(getExperimentVariant(draft, { expose: true }), other);
  assert.deepEqual(fake.state.exposures, []);
});

test("auth experiments state the sample they need per arm before a result may be read", () => {
  const authKeys = KEYS.filter((key) => key.startsWith("auth_"));
  assert.ok(authKeys.length >= 4);
  for (const key of authKeys) {
    assert.equal(
      (EXPERIMENTS[key] as ExperimentDefinition).minSamplePerArm,
      390,
      `${key}: 10-point change, 95% confidence, 80% power, 45% baseline`,
    );
  }
});

test("a running experiment with no PostHog flag is a rollout, not a test", () => {
  // Round-four finding AUTH4-2: no flag existed in PostHog, so every "running" test served
  // control. These predate the finding and run on their fallback until sh creates their flags;
  // this list only shrinks. Anything new that is "running" must be a rollout whose fallback is
  // the arm everyone should get.
  const RUNNING_WITHOUT_FLAG: readonly string[] = [
    "welcome_back_v2",
    "onboarding_account_framing_v1",
    "stall_bar_cta_v1",
    "catalog_save_to_list_v1",
    "review_tile_labels_v1",
    "profile_first_review_nudge_v1",
  ];
  // These have a multivariate PostHog flag (created 2026-10-31), switched off until launch, so
  // they serve their fallback until the flag is turned on: no app release needed to start them.
  const FLAG_EXISTS_OFF_UNTIL_LAUNCH: readonly string[] = [
    "saved_card_density_v1",
    "saved_default_sort_v1",
    "saved_remove_undo_v1",
  ];
  const running = KEYS.filter(
    (key) => (EXPERIMENTS[key] as ExperimentDefinition).status === "running",
  );
  const unexpected = running.filter(
    (key) =>
      !(EXPERIMENTS[key] as ExperimentDefinition).rollout &&
      !RUNNING_WITHOUT_FLAG.includes(key) &&
      !FLAG_EXISTS_OFF_UNTIL_LAUNCH.includes(key),
  );
  assert.deepEqual(unexpected, [], "new running experiments need a PostHog flag: start as draft");
  const stale = [...RUNNING_WITHOUT_FLAG, ...FLAG_EXISTS_OFF_UNTIL_LAUNCH].filter(
    (key) => !running.includes(key as ExperimentKey),
  );
  assert.deepEqual(stale, [], "these are no longer running: remove them from the list");
});

test("the email-code release serves the code form unless a flag says control", () => {
  assert.equal(getExperimentVariant("auth_email_code_first_v1", { expose: true }), "email_code");
  const fake = fakeSource({ auth_email_code_first_v1: "control" });
  setExperimentFlagSource(fake.source);
  assert.equal(getExperimentVariant("auth_email_code_first_v1", { expose: true }), "control");
  assert.deepEqual(fake.state.exposures, ["auth_email_code_first_v1"]);
});
