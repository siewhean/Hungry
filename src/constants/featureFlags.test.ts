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

test("merchantClaimCtaEnabled is available only outside production", () => {
  assert.equal(resolveFeatureFlags("development").merchantClaimCtaEnabled, true);
  assert.equal(resolveFeatureFlags(undefined, "test").merchantClaimCtaEnabled, false);
  assert.equal(resolveFeatureFlags("qa", "test").merchantClaimCtaEnabled, false);
  assert.equal(resolveFeatureFlags(undefined, "development").merchantClaimCtaEnabled, true);
  assert.equal(resolveFeatureFlags("production").merchantClaimCtaEnabled, false);
});

test("merchantCentreEnabled is available only outside production", () => {
  assert.equal(resolveFeatureFlags("development").merchantCentreEnabled, true);
  assert.equal(resolveFeatureFlags("staging").merchantCentreEnabled, true);
  assert.equal(resolveFeatureFlags("production").merchantCentreEnabled, false);
  assert.equal(resolveFeatureFlags(undefined, "test").merchantCentreEnabled, false);
  assert.equal(resolveFeatureFlags("qa", "test").merchantCentreEnabled, false);
  assert.equal(resolveFeatureFlags(undefined, "development").merchantCentreEnabled, true);
});

test("prototypeRoutesEnabled is available outside production only", () => {
  assert.equal(resolveFeatureFlags("development").prototypeRoutesEnabled, true);
  assert.equal(resolveFeatureFlags("staging").prototypeRoutesEnabled, true);
  assert.equal(resolveFeatureFlags(undefined, "test").prototypeRoutesEnabled, false);
  assert.equal(resolveFeatureFlags("qa", "test").prototypeRoutesEnabled, false);
  assert.equal(resolveFeatureFlags(undefined, "development").prototypeRoutesEnabled, true);
  assert.equal(resolveFeatureFlags("production").prototypeRoutesEnabled, false);
});

test("advanced social and gamification surfaces are disabled in production", () => {
  const flags = resolveFeatureFlags("production");

  assert.equal(flags.directMessagesEnabled, false);
  assert.equal(flags.commentsEnabled, false);
  assert.equal(flags.gamificationEnabled, false);
  assert.equal(flags.collectionsEnabled, false);
  assert.equal(flags.storiesEnabled, false);
  assert.equal(flags.merchantCentreEnabled, false);
  assert.equal(flags.merchantClaimCtaEnabled, false);
  assert.equal(flags.oauthProvidersEnabled, false);
  assert.equal(flags.floorplansEnabled, false);
});

test("audited social and gamification surfaces are available in explicit non-production environments", () => {
  for (const env of ["development", "staging"]) {
    const flags = resolveFeatureFlags(env);

    assert.equal(flags.directMessagesEnabled, true);
    assert.equal(flags.commentsEnabled, true);
    assert.equal(flags.oauthProvidersEnabled, true);
    assert.equal(flags.gamificationEnabled, true);
    assert.equal(flags.collectionsEnabled, true);
    assert.equal(flags.storiesEnabled, true);
  }
});

test("unknown or missing environments fail closed outside local development", () => {
  for (const env of [undefined, "qa"]) {
    const flags = resolveFeatureFlags(env, "test");

    assert.equal(flags.directMessagesEnabled, false);
    assert.equal(flags.commentsEnabled, false);
    assert.equal(flags.oauthProvidersEnabled, false);
    assert.equal(flags.gamificationEnabled, false);
    assert.equal(flags.collectionsEnabled, false);
    assert.equal(flags.storiesEnabled, false);
    assert.equal(flags.merchantCentreEnabled, false);
    assert.equal(flags.merchantClaimCtaEnabled, false);
    assert.equal(flags.prototypeRoutesEnabled, false);
  }
});

test("indoor floorplans stay disabled in every environment until launch gates pass", () => {
  for (const env of ["development", "staging", "production", undefined, "qa"]) {
    assert.equal(resolveFeatureFlags(env, "test").floorplansEnabled, false);
  }
});

test("wheel parties and Crave stay out of production", () => {
  const production = resolveFeatureFlags("production");
  assert.equal(production.wheelPartyEnabled, false);
  assert.equal(production.craveEnabled, false);
  assert.equal("hungryWheelEnabled" in production, false);

  for (const env of ["development", "staging"]) {
    const flags = resolveFeatureFlags(env);
    assert.equal(flags.wheelPartyEnabled, true);
    assert.equal(flags.craveEnabled, true);
  }
});
