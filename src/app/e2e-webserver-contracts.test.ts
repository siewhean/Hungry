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
