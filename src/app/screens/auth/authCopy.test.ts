import assert from "node:assert/strict";
import test from "node:test";

import {
  getAuthProviderButtonLabel,
  getAuthProviderUnavailableMessage,
  getProviderErrorMessage,
} from "./authCopy";

const copy = { cancelled: "Sign-in cancelled.", failed: "Something went wrong." };

test("provider button labels follow the screen's intent", () => {
  assert.equal(getAuthProviderButtonLabel("google", "continue"), "Continue with Google");
  assert.equal(getAuthProviderButtonLabel("apple", "signIn"), "Sign in with Apple");
});

test("a provider that is not enabled sends the person to email", () => {
  assert.match(getAuthProviderUnavailableMessage("google"), /Google sign-in isn't available/);
  assert.equal(
    getProviderErrorMessage(
      new Error("Unsupported provider: provider is not enabled"),
      "google",
      copy,
    ),
    getAuthProviderUnavailableMessage("google"),
  );
});

test("a cancelled provider sign-in says so, and anything else gets the friendly failure", () => {
  assert.equal(getProviderErrorMessage(new Error("User cancelled"), "apple", copy), copy.cancelled);
  assert.equal(getProviderErrorMessage(new Error("state mismatch"), "google", copy), copy.failed);
  assert.equal(getProviderErrorMessage(undefined, "google", copy), copy.failed);
});
