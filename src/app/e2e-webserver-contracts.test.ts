import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";

import { assertSourceIncludes, readRepoFile } from "@/test/sourceContracts";

const require = createRequire(import.meta.url);

function withEnv<T>(env: Record<string, string | undefined>, callback: () => T): T {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(env)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("Playwright starts Expo Web through the deterministic E2E wrapper path", () => {
  const config = readRepoFile("playwright.config.ts");
  const runExpo = readRepoFile("scripts/run-expo.cjs");

  assertSourceIncludes(
    config,
    [
      /command: `node \.\/scripts\/run-expo\.cjs start --localhost --port=\$\{port\} --clear`/,
      /HUNGRY_EXPO_E2E_WEBSERVER: "1"/,
      /EXPO_PUBLIC_APP_ENV: "development"/,
      /CI: "1"/,
    ],
    "Playwright webServer config",
  );

  assertSourceIncludes(
    runExpo,
    [
      /assertNonInteractiveStartPortAvailableAsync\(args, env\)/,
      /env\.RCT_METRO_PORT = String\(port\)/,
      /canListenAsync\(port, "127\.0\.0\.1"\)/,
      /Choose a free E2E_PORT or rerun from an environment with localhost bind access/,
    ],
    "Expo wrapper non-interactive port guard",
  );
});

test("the E2E-only launcher cannot be enabled by a released build", () => {
  const rootNavigator = readRepoFile("src/app/navigation/RootNavigator.tsx");
  const appConfig = readRepoFile("app.config.js");
  const appBody = readRepoFile("src/app/AppBody.tsx");
  const e2eRuntime = readRepoFile("src/lib/runtime/e2eDeveloperLauncher.ts");
  const e2eGate = readRepoFile("src/lib/runtime/e2eDeveloperLauncherGate.ts");

  assertSourceIncludes(
    rootNavigator,
    [
      /const isDeveloperLauncherAvailable = __DEV__ \|\| isE2eDeveloperLauncherBuild\(\)/,
      /initialRouteName=\{isDeveloperLauncherAvailable \? "DeveloperLauncher" : "Splash"\}/,
    ],
    "E2E launcher root route",
  );

  assertSourceIncludes(
    appConfig,
    [
      /appEnv === "development"/,
      /process\.env\.EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE === "mock"/,
      /process\.env\.HUNGRY_EXPO_E2E_WEBSERVER === "1"/,
    ],
    "Expo config",
  );
  assertSourceIncludes(
    e2eRuntime,
    [/isE2eDeveloperLauncherBuildFor/, /hungry\.e2eDeveloperLauncher/],
    "E2E runtime gate",
  );
  assertSourceIncludes(
    e2eGate,
    [
      /platform === "web"/,
      /extra\?\.appEnv === "development"/,
      /extra\?\.e2eDeveloperLauncherEnabled === true/,
    ],
    "E2E runtime build gate",
  );
  assertSourceIncludes(
    appBody,
    [/isAuthenticated \|\| isE2eDeveloperLauncherAvailable/],
    "E2E app shell gate",
  );
});

test("only the Playwright Expo Web config can compile the E2E launcher", () => {
  const loadConfig = require("../../app.config.js") as () => {
    extra?: { appEnv?: string; e2eDeveloperLauncherEnabled?: boolean };
  };
  const eas = JSON.parse(readRepoFile("eas.json")) as {
    build: Record<string, { environment?: string; env?: Record<string, string> }>;
  };

  const e2eConfig = withEnv(
    {
      EXPO_PUBLIC_APP_ENV: "development",
      EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE: "mock",
      HUNGRY_EXPO_E2E_WEBSERVER: "1",
    },
    () => loadConfig(),
  );
  assert.equal(e2eConfig.extra?.e2eDeveloperLauncherEnabled, true);

  const normalDevelopmentWebConfig = withEnv(
    {
      EXPO_PUBLIC_APP_ENV: "development",
      EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE: "mock",
      HUNGRY_EXPO_E2E_WEBSERVER: undefined,
    },
    () => loadConfig(),
  );
  assert.equal(normalDevelopmentWebConfig.extra?.e2eDeveloperLauncherEnabled, false);

  for (const [profile, appEnv, environment] of [
    ["internal-alpha", "staging", "preview"],
    ["preview", "staging", "preview"],
    ["production", "production", "production"],
  ] as const) {
    assert.equal(eas.build[profile]?.env?.EXPO_PUBLIC_APP_ENV, appEnv);
    assert.equal(eas.build[profile]?.env?.EXPO_PUBLIC_HUNGRY_DATA_SOURCE, "supabase");
    assert.equal(eas.build[profile]?.env?.HUNGRY_EXPO_E2E_WEBSERVER, undefined);
    assert.equal(eas.build[profile]?.environment, environment);

    const releasedConfig = withEnv(
      {
        EXPO_PUBLIC_APP_ENV: appEnv,
        EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE: "mock",
        HUNGRY_EXPO_E2E_WEBSERVER: "1",
      },
      () => loadConfig(),
    );
    assert.equal(releasedConfig.extra?.e2eDeveloperLauncherEnabled, false, profile);
  }
});

test("released EAS Update publication strips E2E inputs and pins Supabase", () => {
  const packageJson = JSON.parse(readRepoFile("package.json")) as {
    scripts?: Record<string, string>;
  };
  const publisher = readRepoFile("scripts/publish-eas-update.mjs");

  assert.equal(
    packageJson.scripts?.["update:preview"],
    "node ./scripts/publish-eas-update.mjs preview",
  );
  assert.equal(
    packageJson.scripts?.["update:production"],
    "node ./scripts/publish-eas-update.mjs production",
  );
  assertSourceIncludes(
    publisher,
    [
      /"internal-alpha": \{ appEnv: "staging", channel: "internal-alpha", environment: "preview" \}/,
      /preview: \{ appEnv: "staging", channel: "preview", environment: "preview" \}/,
      /production: \{ appEnv: "production", channel: "production", environment: "production" \}/,
      /EXPO_PUBLIC_HUNGRY_DATA_SOURCE: "supabase"/,
      /delete environment\.EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE/,
      /delete environment\.HUNGRY_EXPO_E2E_WEBSERVER/,
    ],
    "released EAS Update publisher",
  );

  for (const [profile, appEnv, environment] of [
    ["internal-alpha", "staging", "preview"],
    ["preview", "staging", "preview"],
    ["production", "production", "production"],
  ] as const) {
    const output = execFileSync(
      process.execPath,
      ["scripts/publish-eas-update.mjs", profile, "--print-config"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE: "mock",
          HUNGRY_EXPO_E2E_WEBSERVER: "1",
        },
      },
    );
    const config = JSON.parse(output) as Record<string, unknown>;

    assert.deepEqual(config, {
      appEnv,
      channel: profile,
      environment,
      e2eDataSource: null,
      e2eWebserver: null,
      source: "supabase",
    });
  }
});
