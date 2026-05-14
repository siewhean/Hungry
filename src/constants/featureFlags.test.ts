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

test("merchantCentreEnabled is true in staging", () => {
  const flags = resolveFeatureFlags("staging");
  assert.equal(flags.merchantCentreEnabled, true);
});

test("merchantCentreEnabled is false in production", () => {
  const flags = resolveFeatureFlags("production");
  assert.equal(flags.merchantCentreEnabled, false);
});

test("merchantCentreEnabled defaults to false outside staging", () => {
  assert.equal(resolveFeatureFlags("development").merchantCentreEnabled, false);
  assert.equal(resolveFeatureFlags(undefined).merchantCentreEnabled, false);
  assert.equal(resolveFeatureFlags("qa").merchantCentreEnabled, false);
});

test("prototypeRoutesEnabled is available outside production only", () => {
  assert.equal(resolveFeatureFlags("development").prototypeRoutesEnabled, true);
  assert.equal(resolveFeatureFlags("staging").prototypeRoutesEnabled, true);
  assert.equal(resolveFeatureFlags(undefined).prototypeRoutesEnabled, true);
  assert.equal(resolveFeatureFlags("qa").prototypeRoutesEnabled, true);
  assert.equal(resolveFeatureFlags("production").prototypeRoutesEnabled, false);
});
