import assert from "node:assert/strict";
import test from "node:test";

import { resolveFeatureFlags } from "@/constants/featureFlags";

test("merchantClaimCtaEnabled is true in staging", () => {
  const flags = resolveFeatureFlags("staging");
  assert.equal(flags.merchantClaimCtaEnabled, true);
});

test("merchantClaimCtaEnabled is false in production", () => {
  const flags = resolveFeatureFlags("production");
  assert.equal(flags.merchantClaimCtaEnabled, false);
});

test("merchantClaimCtaEnabled defaults to false outside staging", () => {
  assert.equal(resolveFeatureFlags("development").merchantClaimCtaEnabled, false);
  assert.equal(resolveFeatureFlags(undefined).merchantClaimCtaEnabled, false);
  assert.equal(resolveFeatureFlags("qa").merchantClaimCtaEnabled, false);
});

test("merchantCentreEnabled is available for Full Audit V1 beta surfaces", () => {
  assert.equal(resolveFeatureFlags("development").merchantCentreEnabled, true);
  assert.equal(resolveFeatureFlags("staging").merchantCentreEnabled, true);
  assert.equal(resolveFeatureFlags("production").merchantCentreEnabled, true);
  assert.equal(resolveFeatureFlags(undefined).merchantCentreEnabled, true);
  assert.equal(resolveFeatureFlags("qa").merchantCentreEnabled, true);
});

test("prototypeRoutesEnabled is available outside production only", () => {
  assert.equal(resolveFeatureFlags("development").prototypeRoutesEnabled, true);
  assert.equal(resolveFeatureFlags("staging").prototypeRoutesEnabled, true);
  assert.equal(resolveFeatureFlags(undefined).prototypeRoutesEnabled, true);
  assert.equal(resolveFeatureFlags("qa").prototypeRoutesEnabled, true);
  assert.equal(resolveFeatureFlags("production").prototypeRoutesEnabled, false);
});

test("audited social and gamification surfaces are enabled in production", () => {
  const flags = resolveFeatureFlags("production");

  assert.equal(flags.directMessagesEnabled, true);
  assert.equal(flags.commentsEnabled, true);
  assert.equal(flags.gamificationEnabled, true);
  assert.equal(flags.collectionsEnabled, true);
  assert.equal(flags.storiesEnabled, true);
  assert.equal(flags.merchantCentreEnabled, true);
  assert.equal(flags.oauthProvidersEnabled, false);
  assert.equal(flags.floorplansEnabled, false);
});

test("audited social and gamification surfaces are available outside production", () => {
  for (const env of ["development", "staging", undefined, "qa"]) {
    const flags = resolveFeatureFlags(env);

    assert.equal(flags.directMessagesEnabled, true);
    assert.equal(flags.commentsEnabled, true);
    assert.equal(flags.oauthProvidersEnabled, true);
    assert.equal(flags.gamificationEnabled, true);
    assert.equal(flags.collectionsEnabled, true);
    assert.equal(flags.storiesEnabled, true);
  }
});

test("indoor floorplans stay disabled in every environment until launch gates pass", () => {
  for (const env of ["development", "staging", "production", undefined, "qa"]) {
    assert.equal(resolveFeatureFlags(env).floorplansEnabled, false);
  }
});
