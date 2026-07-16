import assert from "node:assert/strict";
import test from "node:test";

import { createContentSecurityPolicy, createCspNonce } from "./contentSecurityPolicy.ts";

test("production CSP nonces scripts and style elements without unsafe script execution", () => {
  const nonce = "dGVzdC1ub25jZQ==";
  const policy = createContentSecurityPolicy(nonce);

  assert.match(policy, new RegExp(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`));
  assert.match(policy, new RegExp(`style-src 'self' 'nonce-${nonce}'`));
  assert.match(policy, new RegExp(`style-src-elem 'self' 'nonce-${nonce}'`));
  assert.match(policy, /style-src-attr 'unsafe-inline'/);
  assert.match(policy, /script-src-attr 'none'/);
  assert.match(policy, /frame-src 'none'/);
  assert.match(policy, /connect-src 'self'/);
  assert.doesNotMatch(policy, /connect-src[^;]*https:/);
  assert.match(policy, /img-src[^;]*https:\/\/images\.unsplash\.com/);
  assert.doesNotMatch(policy, /img-src[^;]* https:(?:;|\s)/);
  assert.doesNotMatch(policy, /script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(policy, /script-src[^;]*'unsafe-eval'/);
  assert.match(policy, /upgrade-insecure-requests/);
});

test("development CSP permits framework evaluation but not arbitrary inline scripts", () => {
  const policy = createContentSecurityPolicy("ZGV2LW5vbmNl", { development: true });

  assert.match(policy, /script-src[^;]*'unsafe-eval'/);
  assert.doesNotMatch(policy, /script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(policy, /upgrade-insecure-requests/);
});

test("CSP nonces are fresh and reject directive injection characters", () => {
  assert.notEqual(createCspNonce(), createCspNonce());
  assert.throws(() => createContentSecurityPolicy("bad'; script-src *"), /invalid characters/);
});
