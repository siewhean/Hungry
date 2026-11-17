import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { __testHashMessage } from "@/lib/services/supabase/pkceCryptoPolyfill";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

test("getConfiguredDataSource prefers HUNGRY_DATA_SOURCE when set", () => {
  const previousPrivate = process.env.HUNGRY_DATA_SOURCE;
  const previousPublic = process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE;

  process.env.HUNGRY_DATA_SOURCE = "supabase";
  process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = "mock";
  assert.equal(getConfiguredDataSource(), "supabase");

  process.env.HUNGRY_DATA_SOURCE = "mock";
  assert.equal(getConfiguredDataSource(), "mock");

  restoreEnv("HUNGRY_DATA_SOURCE", previousPrivate);
  restoreEnv("EXPO_PUBLIC_HUNGRY_DATA_SOURCE", previousPublic);
});

test("getConfiguredDataSource falls back to EXPO_PUBLIC_HUNGRY_DATA_SOURCE when private var blank", () => {
  const previousPrivate = process.env.HUNGRY_DATA_SOURCE;
  const previousPublic = process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE;

  process.env.HUNGRY_DATA_SOURCE = "";
  process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = "supabase";
  assert.equal(getConfiguredDataSource(), "supabase");

  restoreEnv("HUNGRY_DATA_SOURCE", previousPrivate);
  restoreEnv("EXPO_PUBLIC_HUNGRY_DATA_SOURCE", previousPublic);
});

test("getConfiguredDataSource lets E2E public source override local dotenv defaults", () => {
  const previousE2e = process.env.EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE;
  const previousPrivate = process.env.HUNGRY_DATA_SOURCE;
  const previousPublic = process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE;

  process.env.EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE = "mock";
  process.env.HUNGRY_DATA_SOURCE = "supabase";
  process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = "supabase";
  assert.equal(getConfiguredDataSource(), "mock");

  restoreEnv("EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE", previousE2e);
  restoreEnv("HUNGRY_DATA_SOURCE", previousPrivate);
  restoreEnv("EXPO_PUBLIC_HUNGRY_DATA_SOURCE", previousPublic);
});

test("released builds stay on Supabase even when a mock or Excel override is injected", () => {
  const previousEnvironment = process.env.EXPO_PUBLIC_APP_ENV;
  const previousE2e = process.env.EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE;
  const previousPrivate = process.env.HUNGRY_DATA_SOURCE;
  const previousPublic = process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE;

  process.env.EXPO_PUBLIC_APP_ENV = "production";
  process.env.EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE = "mock";
  process.env.HUNGRY_DATA_SOURCE = "excel";
  process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = "mock";
  assert.equal(getConfiguredDataSource(), "supabase");

  restoreEnv("EXPO_PUBLIC_APP_ENV", previousEnvironment);
  restoreEnv("EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE", previousE2e);
  restoreEnv("HUNGRY_DATA_SOURCE", previousPrivate);
  restoreEnv("EXPO_PUBLIC_HUNGRY_DATA_SOURCE", previousPublic);
});

test("missing Supabase credentials do not silently select mock data", () => {
  const previousEnvironment = process.env.EXPO_PUBLIC_APP_ENV;
  const previousE2e = process.env.EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE;
  const previousPrivate = process.env.HUNGRY_DATA_SOURCE;
  const previousPublic = process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE;

  process.env.EXPO_PUBLIC_APP_ENV = "production";
  process.env.EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE = "";
  process.env.HUNGRY_DATA_SOURCE = "";
  process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = "";
  assert.equal(getConfiguredDataSource(), "supabase");

  restoreEnv("EXPO_PUBLIC_APP_ENV", previousEnvironment);
  restoreEnv("EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE", previousE2e);
  restoreEnv("HUNGRY_DATA_SOURCE", previousPrivate);
  restoreEnv("EXPO_PUBLIC_HUNGRY_DATA_SOURCE", previousPublic);
});

test("Supabase client persists auth sessions through secure storage with PKCE enabled", () => {
  const source = read("src/lib/services/supabase/client.ts");

  assert.match(
    source,
    /import \{ createGenerationAuthStorage, retireAuthStorage \} from "\.\/authStorage"/,
  );
  assert.match(source, /import \{ installPkceCryptoPolyfill \} from "\.\/pkceCryptoPolyfill"/);
  assert.match(source, /installPkceCryptoPolyfill\(\);\s*if \(cachedClient !== undefined\)/);
  assert.ok(
    source.indexOf("installPkceCryptoPolyfill()") <
      source.indexOf('require("@supabase/supabase-js")'),
    "PKCE/WebCrypto polyfill must install before supabase-js is loaded",
  );
  assert.match(source, /storage: createGenerationAuthStorage\(\)/);
  assert.match(source, /persistSession: true/);
  assert.match(source, /autoRefreshToken: true/);
  assert.match(source, /detectSessionInUrl: false/);
  assert.match(source, /flowType: "pkce"/);
});

test("Supabase auth storage mirrors tokens to AsyncStorage only in dev/test fallback mode", () => {
  const source = read("src/lib/services/supabase/authStorage.ts");

  assert.match(source, /canUsePlaintextTokenFallback\(\)/);
  assert.match(source, /await asyncStorage\.setItem\(name, value\)/);
  assert.match(source, /await asyncStorage\.removeItem\(name\)/);
  assert.match(
    source,
    /Dev\/test simulator reloads[\s\S]*Keep a dev-only[\s\S]*AsyncStorage mirror/,
  );
  assert.match(source, /Production keeps auth material out of plaintext AsyncStorage/);
});

test("PKCE SHA-256 fallback produces the standard digest", () => {
  assert.equal(
    __testHashMessage(new TextEncoder().encode("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
