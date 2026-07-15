import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getConfiguredDataSource,
  getSupabaseConfigurationError,
} from "@/lib/services/supabase/client";
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

test("production data-source configuration fails closed instead of selecting mock", () => {
  const previousAppEnv = process.env.EXPO_PUBLIC_APP_ENV;
  const previousE2e = process.env.EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE;
  const previousPrivate = process.env.HUNGRY_DATA_SOURCE;
  const previousPublic = process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE;

  process.env.EXPO_PUBLIC_APP_ENV = "production";
  process.env.EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE = "";
  process.env.HUNGRY_DATA_SOURCE = "";
  process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = "";
  assert.throws(getConfiguredDataSource, /EXPO_PUBLIC_HUNGRY_DATA_SOURCE is required/);

  // A runtime service-provider override must not bypass the client-bundled
  // production source requirement.
  const clientSource = read("src/lib/services/supabase/client.ts");
  assert.ok(
    clientSource.indexOf("if (isProductionRuntime())") <
      clientSource.indexOf("if (configuredDataSourceOverride)"),
  );

  process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = "unknown";
  assert.throws(getConfiguredDataSource, /Unsupported production data source/);

  process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = "mock";
  assert.throws(getConfiguredDataSource, /must use the Supabase data source/);

  process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE = "supabase";
  assert.throws(getConfiguredDataSource, /Supabase URL and public key are required/);

  restoreEnv("EXPO_PUBLIC_APP_ENV", previousAppEnv);
  restoreEnv("EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE", previousE2e);
  restoreEnv("HUNGRY_DATA_SOURCE", previousPrivate);
  restoreEnv("EXPO_PUBLIC_HUNGRY_DATA_SOURCE", previousPublic);
});

test("Supabase production credential validation rejects missing, insecure, and placeholder values", () => {
  assert.equal(getSupabaseConfigurationError("", ""), "Supabase URL and public key are required");
  assert.equal(
    getSupabaseConfigurationError("http://project.supabase.co", "sb_publishable_valid-key-value"),
    "Supabase URL must be an HTTPS endpoint without embedded credentials",
  );
  assert.equal(
    getSupabaseConfigurationError("https://project.supabase.co", "your-anon-key"),
    "Supabase public key is invalid or a placeholder",
  );
  assert.equal(
    getSupabaseConfigurationError("https://project.supabase.co", "sb_publishable_0123456789abcdef"),
    null,
  );
  assert.equal(
    getSupabaseConfigurationError(
      "https://project.supabase.co",
      "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.signature1234567890",
    ),
    null,
  );
  assert.equal(
    getSupabaseConfigurationError(
      "https://project.supabase.co",
      "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature1234567890",
    ),
    "A service-role key must never be bundled in the mobile client",
  );
  assert.equal(
    getSupabaseConfigurationError("https://project.supabase.co", "random-but-long-public-key"),
    "Supabase public key format is not recognized",
  );
});

test("Android release artifacts remove debug/audio capabilities and never use debug signing", () => {
  const releaseManifest = read("android/app/src/release/AndroidManifest.xml");
  const buildGradle = read("android/app/build.gradle");
  const gradleProperties = read("android/gradle.properties");
  const ciWorkflow = read(".github/workflows/ci.yml");

  for (const capability of [
    "SYSTEM_ALERT_WINDOW",
    "FOREGROUND_SERVICE_MEDIA_PLAYBACK",
    "MODIFY_AUDIO_SETTINGS",
    "RECORD_AUDIO",
    "WRITE_EXTERNAL_STORAGE",
    "AudioControlsService",
  ]) {
    assert.match(releaseManifest, new RegExp(`${capability}[\\s\\S]*tools:node=\\"remove\\"`));
  }
  assert.doesNotMatch(buildGradle, /release\s*\{[\s\S]{0,300}signingConfig signingConfigs\.debug/);
  assert.match(buildGradle, /HUNGRY_RELEASE_STORE_FILE/);
  assert.match(buildGradle, /android\.injected\.signing\.store\.file/);
  assert.match(buildGradle, /System\.getenv\('EAS_BUILD'\) == 'true'/);
  assert.match(buildGradle, /file\('eas-build\.gradle'\)\.exists\(\)/);
  assert.match(buildGradle, /rootProject\.file\('\.\.\/credentials\.json'\)\.exists\(\)/);
  assert.match(buildGradle, /Hungry Android release signing is not configured/);
  assert.match(gradleProperties, /android\.enableMinifyInReleaseBuilds=true/);
  assert.match(gradleProperties, /android\.enableShrinkResourcesInReleaseBuilds=true/);
  assert.match(ciWorkflow, /Build and wait for EAS native gates/);
  assert.match(
    ciWorkflow,
    /eas-cli@18\.12\.3 build --platform all --profile preview --non-interactive/,
  );
  assert.doesNotMatch(ciWorkflow, /eas-cli[^\n]*build[^\n]*--no-wait/);
});

test("Supabase client persists auth sessions through secure storage with PKCE enabled", () => {
  const source = read("src/lib/services/supabase/client.ts");

  assert.match(source, /import \{ supabaseAuthStorage \} from "\.\/authStorage"/);
  assert.match(source, /import \{ installPkceCryptoPolyfill \} from "\.\/pkceCryptoPolyfill"/);
  assert.match(source, /installPkceCryptoPolyfill\(\)/);
  assert.match(source, /if \(cachedClient !== undefined\)/);
  assert.ok(
    source.indexOf("installPkceCryptoPolyfill()") <
      source.indexOf('require("@supabase/supabase-js")'),
    "PKCE/WebCrypto polyfill must install before supabase-js is loaded",
  );
  assert.match(source, /storage: supabaseAuthStorage/);
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
