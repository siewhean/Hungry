import assert from "node:assert/strict";
import test from "node:test";

import { getEnabledAuthProviders } from "@/app/screens/auth/authProviders";

const flags = (oauthProvidersEnabled: boolean, googleSignInEnabled: boolean) => ({
  oauthProvidersEnabled,
  googleSignInEnabled,
});

test("no provider shows until its flag is on", () => {
  assert.deepEqual(getEnabledAuthProviders("android", flags(false, false)), []);
  assert.deepEqual(getEnabledAuthProviders("web", flags(false, false)), []);
});

test("Google shows on Android and web when its flag is on", () => {
  assert.deepEqual(getEnabledAuthProviders("android", flags(false, true)), ["google"]);
  assert.deepEqual(getEnabledAuthProviders("web", flags(false, true)), ["google"]);
});

test("iPhone offers Google only next to Apple (App Store rule 4.8)", () => {
  assert.deepEqual(getEnabledAuthProviders("ios", flags(false, true)), []);
  assert.deepEqual(getEnabledAuthProviders("ios", flags(true, false)), ["apple"]);
  assert.deepEqual(getEnabledAuthProviders("ios", flags(true, true)), ["apple", "google"]);
});

test("Apple follows the provider flag and is listed first", () => {
  assert.deepEqual(getEnabledAuthProviders("android", flags(true, true)), ["apple", "google"]);
});
