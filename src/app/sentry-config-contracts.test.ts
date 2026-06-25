import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function readRepoFile(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

function loadAppConfig() {
  const configPath = resolve(process.cwd(), "app.config.js");
  delete require.cache[configPath];
  return require(configPath) as (input?: { config?: Record<string, unknown> }) => {
    plugins?: unknown[];
  };
}

function findSentryPlugin(plugins: unknown[]) {
  return plugins.find(
    (plugin) =>
      Array.isArray(plugin) &&
      plugin[0] === "@sentry/react-native/expo" &&
      plugin[1] &&
      typeof plugin[1] === "object",
  ) as ["@sentry/react-native/expo", Record<string, unknown>] | undefined;
}

test("Sentry app initialization ignores missing or placeholder DSNs", () => {
  const appSource = readRepoFile("App.tsx");

  assert.ok(appSource.includes("function isUsableSentryDsn"));
  assert.ok(appSource.includes('value.includes("${")'));
  assert.ok(appSource.includes('parsed.protocol === "https:"'));
  assert.ok(appSource.includes('parsed.hostname.includes("sentry.io")'));
  assert.ok(appSource.includes("const shouldEnableSentry = isUsableSentryDsn(sentryDsn)"));
});

test("Sentry Expo plugin reads org and project from env without embedding auth token", () => {
  const previous = {
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
  };

  process.env.SENTRY_ORG = "hungry-test-org";
  process.env.SENTRY_PROJECT = "hungry-test-project";
  process.env.SENTRY_AUTH_TOKEN = "test-token";

  try {
    const localConfig = loadAppConfig()({});
    const localSentryPlugin = findSentryPlugin(localConfig.plugins ?? []);
    assert.ok(localSentryPlugin);
    assert.equal(localSentryPlugin[1].organization, "hungry-test-org");
    assert.equal(localSentryPlugin[1].project, "hungry-test-project");
    assert.equal(localSentryPlugin[1].authToken, undefined);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key as keyof typeof previous];
      } else {
        process.env[key as keyof typeof previous] = value;
      }
    }
  }
});
