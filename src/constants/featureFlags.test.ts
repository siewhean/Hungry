import assert from "node:assert/strict";
import test from "node:test";

import { resolveFeatureFlags } from "@/constants/featureFlags";

const RELEASE_DISABLED_FLAGS = [
  "socialFeedEnabled",
  "postCreationEnabled",
  "reviewCreationEnabled",
  "activityEnabled",
  "readsEnabled",
  "mapEnabled",
  "hungryWheelEnabled",
  "craveEnabled",
  "directMessagesEnabled",
  "commentsEnabled",
  "oauthProvidersEnabled",
  "gamificationEnabled",
  "collectionsEnabled",
  "storiesEnabled",
  "merchantCentreEnabled",
  "merchantClaimCtaEnabled",
  "prototypeRoutesEnabled",
] as const;

test("staging and production default to the narrow Release 0.1 surface", () => {
  for (const appEnv of ["staging", "production"] as const) {
    const flags = resolveFeatureFlags(appEnv, "production", {});

    assert.equal(flags.release01CoreOnly, true);
    assert.equal(flags.catalogReadV2, true);
    assert.equal(flags.favouritesEnabled, false);
    for (const flag of RELEASE_DISABLED_FLAGS) {
      assert.equal(flags[flag], false, `${flag} must fail closed in ${appEnv}`);
    }
  }
});

test("development retains the wider implementation surface", () => {
  const flags = resolveFeatureFlags("development", "development", {});

  assert.equal(flags.release01CoreOnly, false);
  assert.equal(flags.socialFeedEnabled, true);
  assert.equal(flags.postCreationEnabled, true);
  assert.equal(flags.reviewCreationEnabled, true);
  assert.equal(flags.activityEnabled, true);
  assert.equal(flags.readsEnabled, true);
  assert.equal(flags.mapEnabled, true);
  assert.equal(flags.hungryWheelEnabled, true);
  assert.equal(flags.craveEnabled, true);
  assert.equal(flags.favouritesEnabled, true);
  assert.equal(flags.directMessagesEnabled, true);
  assert.equal(flags.commentsEnabled, true);
  assert.equal(flags.oauthProvidersEnabled, true);
  assert.equal(flags.gamificationEnabled, true);
  assert.equal(flags.collectionsEnabled, true);
  assert.equal(flags.storiesEnabled, true);
  assert.equal(flags.merchantCentreEnabled, true);
  assert.equal(flags.merchantClaimCtaEnabled, true);
  assert.equal(flags.prototypeRoutesEnabled, true);
  assert.equal(flags.catalogDiagnosticsEnabled, true);
});

test("staging permits explicit, one-feature-at-a-time QA opt-ins", () => {
  const flags = resolveFeatureFlags("staging", "production", {
    EXPO_PUBLIC_ENABLE_MAP: "1",
    EXPO_PUBLIC_ENABLE_REVIEWS: "1",
  });

  assert.equal(flags.mapEnabled, true);
  assert.equal(flags.reviewCreationEnabled, true);
  assert.equal(flags.socialFeedEnabled, false);
  assert.equal(flags.postCreationEnabled, false);
  assert.equal(flags.prototypeRoutesEnabled, false);
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

test("unknown or missing environments fail closed outside local development", () => {
  for (const appEnv of [undefined, "qa"]) {
    const flags = resolveFeatureFlags(appEnv, "test", {});

    assert.equal(flags.appEnv, "production");
    assert.equal(flags.release01CoreOnly, true);
    assert.equal(flags.catalogReadV2, true);
    for (const flag of RELEASE_DISABLED_FLAGS) {
      assert.equal(flags[flag], false, `${flag} must fail closed when the environment is unknown`);
    }
  }
});

test("indoor floorplans stay disabled in every environment until launch gates pass", () => {
  for (const appEnv of ["development", "staging", "production", undefined, "qa"]) {
    assert.equal(resolveFeatureFlags(appEnv, "test", {}).floorplansEnabled, false);
  }
});
