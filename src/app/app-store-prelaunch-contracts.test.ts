import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { assertRepoFileExists, readRepoFile } from "@/test/sourceContracts";

const require = createRequire(import.meta.url);
const repoRoot = process.cwd();

const REQUIRED_PRELAUNCH_REPORTS = [
  "tasks/Roadmap/app-store-google-play-prelaunch-qaqc-checklist.md",
  "tasks/Roadmap/app-file-cleanup-inventory.md",
  "tasks/Roadmap/app-store-data-safety-mapping.md",
  "tasks/Roadmap/app-store-submission-qc-report.md",
  "tasks/Roadmap/google-play-submission-qc-report.md",
  "tasks/Roadmap/app-route-feature-flag-qc-report.md",
  "tasks/Roadmap/app-playwright-prelaunch-report.md",
  "tasks/Roadmap/app-maestro-native-smoke-report.md",
  "tasks/Roadmap/app-prefetch-qc-report.md",
  "tasks/Roadmap/app-security-qc-report.md",
  "tasks/Roadmap/app-privacy-permissions-qc-report.md",
  "tasks/Roadmap/app-ugc-moderation-qc-report.md",
  "tasks/Roadmap/app-final-prelaunch-go-nogo.md",
] as const;

const REQUIRED_MAESTRO_FLOWS = [
  ".maestro/ios-app-launch-smoke.yaml",
  ".maestro/ios-mandatory-auth-smoke.yaml",
  ".maestro/ios-authenticated-fallback-smoke.yaml",
  ".maestro/ios-location-denied-smoke.yaml",
  ".maestro/ios-media-picker-permission.yaml",
  ".maestro/ios-review-post-smoke.yaml",
  ".maestro/android-app-launch-smoke.yaml",
  ".maestro/android-mandatory-auth-smoke.yaml",
  ".maestro/android-media-permission-smoke.yaml",
] as const;

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

function walkFiles(dir: string): string[] {
  return readdirSync(path.join(repoRoot, dir)).flatMap((entry) => {
    const fullPath = path.join(repoRoot, dir, entry);
    const relativePath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      return walkFiles(relativePath);
    }
    return [relativePath];
  });
}

test("prelaunch report bundle exists and keeps store submission no-go until proof lands", () => {
  for (const reportPath of REQUIRED_PRELAUNCH_REPORTS) {
    assertRepoFileExists(reportPath);
  }

  const finalReport = readRepoFile("tasks/Roadmap/app-final-prelaunch-go-nogo.md");
  assert.match(finalReport, /Final status:\s+\*\*No-Go\*\*/);
  assert.match(finalReport, /ASO metadata drafts\s+\|\s+repo-complete draft/);
  assert.match(finalReport, /Reviewer-note template\s+\|\s+repo-complete draft/);
  assert.match(finalReport, /Repo-complete means/);
  assert.match(finalReport, /App Store Connect metadata\/privacy proof\s+\|\s+missing/);
  assert.match(finalReport, /Google Play listing\/Data Safety proof\s+\|\s+missing/);
  assert.match(finalReport, /final ASO metadata owner approval\s+\|\s+missing/);
  assert.match(finalReport, /final reviewer notes\/demo account approval\s+\|\s+missing/);
  assert.match(finalReport, /final screenshot\/image rights approval\s+\|\s+missing/);
  assert.match(finalReport, /iOS EAS\/TestFlight artifact\s+\|\s+missing/);
  assert.match(finalReport, /Android EAS\/AAB\/pre-launch report\s+\|\s+missing/);
});

test("production Expo config strips development-only and unjustified native capabilities", () => {
  const loadConfig = require("../../app.config.js") as () => {
    plugins?: unknown[];
    ios?: { infoPlist?: Record<string, unknown> };
    extra?: { appEnv?: string };
  };

  const productionConfig = withEnv(
    { EXPO_PUBLIC_APP_ENV: "production", NODE_ENV: "production" },
    () => loadConfig(),
  );
  const pluginNames = (productionConfig.plugins ?? []).map((plugin) =>
    Array.isArray(plugin) ? plugin[0] : plugin,
  );
  const infoPlist = productionConfig.ios?.infoPlist ?? {};

  assert.equal(productionConfig.extra?.appEnv, "production");
  assert.equal(pluginNames.includes("expo-dev-client"), false);
  assert.equal(pluginNames.includes("expo-audio"), false);
  assert.equal("NSBonjourServices" in infoPlist, false);
  assert.equal("NSLocalNetworkUsageDescription" in infoPlist, false);
  assert.equal("NSLocationAlwaysUsageDescription" in infoPlist, false);
  assert.equal("NSLocationAlwaysAndWhenInUseUsageDescription" in infoPlist, false);
  assert.equal("NSFaceIDUsageDescription" in infoPlist, false);
  assert.equal("UIBackgroundModes" in infoPlist, false);
});

test("development Expo config keeps dev-client support for local simulator work", () => {
  const loadConfig = require("../../app.config.js") as () => { plugins?: unknown[] };
  const developmentConfig = withEnv(
    { EXPO_PUBLIC_APP_ENV: "development", NODE_ENV: "development" },
    () => loadConfig(),
  );
  const pluginNames = (developmentConfig.plugins ?? []).map((plugin) =>
    Array.isArray(plugin) ? plugin[0] : plugin,
  );

  assert.equal(pluginNames.includes("expo-dev-client"), true);
});

test("native smoke runner exposes mandatory-auth and authenticated-fallback prelaunch flows", () => {
  for (const flowPath of REQUIRED_MAESTRO_FLOWS) {
    assertRepoFileExists(flowPath);
  }

  const packageJson = readRepoFile("package.json");
  const runner = readRepoFile("scripts/run-maestro-smoke.mjs");

  for (const scriptName of [
    "smoke:native:ios:launch",
    "smoke:native:ios:mandatory-auth",
    "smoke:native:ios:authenticated-fallback",
    "smoke:native:ios:auth",
    "smoke:native:ios:location-denied",
    "smoke:native:ios:review-post",
    "smoke:native:android",
    "smoke:native:android:launch",
    "smoke:native:android:mandatory-auth",
    "smoke:native:android:media",
  ]) {
    assert.match(packageJson, new RegExp(`"${scriptName}"`));
  }

  assert.doesNotMatch(packageJson, /smoke:native:(ios|android):guest/);
  assert.match(runner, /"ios-mandatory-auth"/);
  assert.match(runner, /"ios-authenticated-fallback"/);
  assert.match(runner, /"android-mandatory-auth"/);
  assert.doesNotMatch(runner, /guest-browse-smoke/);
  assert.match(runner, /target\.startsWith\("android"\)/);
  assert.match(runner, /appJson\.expo\?\.android\?\.package/);
});

test("service-role environment names stay out of client app source", () => {
  const clientFiles = walkFiles("src").filter(
    (filePath) =>
      /\.(ts|tsx)$/.test(filePath) &&
      !filePath.endsWith(".test.ts") &&
      !filePath.includes("/test/") &&
      !filePath.includes("/lib/services/supabase/server"),
  );

  for (const filePath of clientFiles) {
    const source = readRepoFile(filePath);
    assert.doesNotMatch(
      source,
      /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|SUPABASE_SECRET/i,
      `${filePath} must not reference service-role env names`,
    );
  }
});
