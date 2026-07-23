import test from "node:test";

import { assertSourceIncludes, readRepoFile } from "@/test/sourceContracts";

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
    [/appEnv === "development" && process\.env\.EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE === "mock"/],
    "Expo config",
  );
  assertSourceIncludes(
    e2eRuntime,
    [
      /extra\?\.appEnv === "development"/,
      /extra\?\.e2eDeveloperLauncherEnabled === true/,
      /hungry\.e2eDeveloperLauncher/,
    ],
    "E2E runtime gate",
  );
  assertSourceIncludes(
    appBody,
    [/isAuthenticated \|\| isE2eDeveloperLauncherAvailable/],
    "E2E app shell gate",
  );
});
