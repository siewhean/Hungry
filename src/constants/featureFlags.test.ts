import assert from "node:assert/strict";
import test from "node:test";

import { resolveFeatureFlags } from "@/constants/featureFlags";

// Core surfaces that ship in every environment (main's product decisions).
const SHIPPED_SURFACE_FLAGS = [
  "postCreationEnabled",
  "reviewCreationEnabled",
  "mapEnabled",
  "hungryWheelEnabled",
  "favouritesEnabled",
  "portfoliosEnabled",
  "stallAlertsEnabled",
] as const;

// Archived surfaces (owner decision 2026-10-24): off everywhere unless a build opts in.
const ARCHIVED_FLAGS = ["socialFeedEnabled", "activityEnabled", "directMessagesEnabled"] as const;

// Surfaces that stay out of production (mock-backed or not launch-ready).
const NON_PRODUCTION_FLAGS = [
  "craveEnabled",
  "wheelPartyEnabled",
  "commentsEnabled",
  "oauthProvidersEnabled",
  "gamificationEnabled",
  "collectionsEnabled",
  "storiesEnabled",
  "merchantCentreEnabled",
  "merchantClaimCtaEnabled",
  "prototypeRoutesEnabled",
] as const;

test("production ships main's core surfaces and keeps advanced surfaces closed", () => {
  const flags = resolveFeatureFlags("production", "production", {});

  assert.equal(flags.release01CoreOnly, false);
  for (const flag of SHIPPED_SURFACE_FLAGS) {
    assert.equal(flags[flag], true, `${flag} must ship in production`);
  }
  for (const flag of [...NON_PRODUCTION_FLAGS, ...ARCHIVED_FLAGS]) {
    assert.equal(flags[flag], false, `${flag} must stay out of production`);
  }
});

test("the archived social feed, Activity and Messages are off until a build opts in", () => {
  for (const appEnv of ["development", "staging", "production"] as const) {
    const flags = resolveFeatureFlags(appEnv, "production", {});
    for (const flag of ARCHIVED_FLAGS) {
      assert.equal(flags[flag], false, `${flag} is archived in ${appEnv}`);
    }
  }
  const optedIn = resolveFeatureFlags("development", "development", {
    EXPO_PUBLIC_ENABLE_SOCIAL_FEED: "1",
    EXPO_PUBLIC_ENABLE_ACTIVITY: "1",
    EXPO_PUBLIC_ENABLE_MESSAGES: "1",
  });
  for (const flag of ARCHIVED_FLAGS) {
    assert.equal(optedIn[flag], true, `${flag} can be opted back in`);
  }
});

test("development and staging retain the wider implementation surface", () => {
  for (const appEnv of ["development", "staging"] as const) {
    const flags = resolveFeatureFlags(
      appEnv,
      appEnv === "development" ? "development" : "production",
      {},
    );

    assert.equal(flags.release01CoreOnly, false);
    for (const flag of [...SHIPPED_SURFACE_FLAGS, ...NON_PRODUCTION_FLAGS]) {
      assert.equal(flags[flag], true, `${flag} must be available in ${appEnv}`);
    }
    assert.equal(flags.catalogDiagnosticsEnabled, true);
  }
});

test("build profiles can narrow surfaces one at a time and opt into core-only mode", () => {
  const flags = resolveFeatureFlags("staging", "production", {
    EXPO_PUBLIC_ENABLE_MAP: "0",
    EXPO_PUBLIC_ENABLE_REVIEWS: "0",
    EXPO_PUBLIC_RELEASE_01_CORE_ONLY: "1",
  });

  assert.equal(flags.mapEnabled, false);
  assert.equal(flags.reviewCreationEnabled, false);
  assert.equal(flags.postCreationEnabled, true);
  assert.equal(flags.release01CoreOnly, true);
  assert.equal(flags.favouritesEnabled, true);
});

test("catalog diagnostics remain unavailable in public production", () => {
  assert.equal(
    resolveFeatureFlags("development", "development", {}).catalogDiagnosticsEnabled,
    true,
  );
  assert.equal(resolveFeatureFlags("staging", "production", {}).catalogDiagnosticsEnabled, true);
  assert.equal(
    resolveFeatureFlags("production", "production", {}).catalogDiagnosticsEnabled,
    false,
  );
});

test("unknown or missing environments resolve to production outside local development", () => {
  for (const appEnv of [undefined, "qa"]) {
    const flags = resolveFeatureFlags(appEnv, "test", {});

    assert.equal(flags.appEnv, "production");
    for (const flag of NON_PRODUCTION_FLAGS) {
      assert.equal(flags[flag], false, `${flag} must fail closed when the environment is unknown`);
    }
  }
});

test("indoor floorplans stay disabled in every environment until launch gates pass", () => {
  for (const appEnv of ["development", "staging", "production", undefined, "qa"]) {
    assert.equal(resolveFeatureFlags(appEnv, "test", {}).floorplansEnabled, false);
  }
});

test("wheel solo spin ships everywhere; wheel parties and Crave stay out of production", () => {
  const production = resolveFeatureFlags("production", "production", {});
  assert.equal(production.hungryWheelEnabled, true);
  assert.equal(production.wheelPartyEnabled, false);
  assert.equal(production.craveEnabled, false);

  for (const env of ["development", "staging"]) {
    const flags = resolveFeatureFlags(env, "production", {});
    assert.equal(flags.wheelPartyEnabled, true);
    assert.equal(flags.craveEnabled, true);
  }
});
