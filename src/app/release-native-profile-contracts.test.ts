import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const root = process.cwd();
const require = createRequire(import.meta.url);

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function withEnv<T>(env: Record<string, string | undefined>, callback: () => T): T {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(env)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("released EAS profiles select the matching channel and EAS environment", () => {
  const eas = JSON.parse(read("eas.json")) as {
    cli: { version: string };
    build: Record<string, { channel?: string; environment?: string; env?: Record<string, string> }>;
  };

  assert.equal(eas.cli.version, ">= 21.1.0");
  assert.deepEqual(
    Object.fromEntries(
      ["development", "internal-alpha", "preview", "production"].map((profile) => [
        profile,
        {
          channel: eas.build[profile]?.channel,
          environment: eas.build[profile]?.environment,
          appEnv: eas.build[profile]?.env?.EXPO_PUBLIC_APP_ENV,
          dataSource: eas.build[profile]?.env?.EXPO_PUBLIC_HUNGRY_DATA_SOURCE,
        },
      ]),
    ),
    {
      development: {
        channel: "development",
        environment: "development",
        appEnv: "development",
        dataSource: "supabase",
      },
      "internal-alpha": {
        channel: "internal-alpha",
        environment: "preview",
        appEnv: "staging",
        dataSource: "supabase",
      },
      preview: {
        channel: "preview",
        environment: "preview",
        appEnv: "staging",
        dataSource: "supabase",
      },
      production: {
        channel: "production",
        environment: "production",
        appEnv: "production",
        dataSource: "supabase",
      },
    },
  );
});

test("released config retains only nearby-discovery native permissions", () => {
  const loadConfig = require("../../app.config.js") as () => {
    android?: { permissions?: string[] };
    ios?: { infoPlist?: Record<string, unknown> };
    plugins?: unknown[];
    extra?: { appEnv?: string; e2eDeveloperLauncherEnabled?: boolean };
  };

  const development = withEnv({ EXPO_PUBLIC_APP_ENV: "development", NODE_ENV: "development" }, () =>
    loadConfig(),
  );
  const staging = withEnv({ EXPO_PUBLIC_APP_ENV: "staging", NODE_ENV: "production" }, () =>
    loadConfig(),
  );
  const production = withEnv({ EXPO_PUBLIC_APP_ENV: "production", NODE_ENV: "production" }, () =>
    loadConfig(),
  );

  const pluginNames = (config: typeof staging) =>
    (config.plugins ?? []).map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));
  const removedPlugins = ["expo-dev-client", "expo-audio", "expo-video"];
  const removedKeys = ["NSMicrophoneUsageDescription", "NSPhotoLibraryAddUsageDescription"];

  assert.equal(pluginNames(development).includes("expo-dev-client"), true);
  for (const config of [staging, production]) {
    assert.equal(config.extra?.e2eDeveloperLauncherEnabled, false);
    assert.deepEqual(config.android?.permissions, [
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.CAMERA",
      "android.permission.INTERNET",
      "android.permission.VIBRATE",
    ]);
    assert.equal(config.ios?.infoPlist?.NSLocationWhenInUseUsageDescription !== undefined, true);
    for (const plugin of removedPlugins) assert.equal(pluginNames(config).includes(plugin), false);
    // Real map and camera photos ship in released builds (owner decisions 2026-10-25).
    assert.equal(pluginNames(config).includes("@rnmapbox/maps"), true);
    assert.equal(typeof config.ios?.infoPlist?.NSCameraUsageDescription, "string");
    for (const key of removedKeys) assert.equal(key in (config.ios?.infoPlist ?? {}), false);
  }
});

test("released config blocks library-merged Android permissions", () => {
  const loadConfig = require("../../app.config.js") as () => {
    android?: { permissions?: string[]; blockedPermissions?: string[] };
    plugins?: unknown[];
  };
  const development = withEnv({ EXPO_PUBLIC_APP_ENV: "development", NODE_ENV: "development" }, () =>
    loadConfig(),
  );
  const staging = withEnv({ EXPO_PUBLIC_APP_ENV: "staging", NODE_ENV: "production" }, () =>
    loadConfig(),
  );
  const production = withEnv({ EXPO_PUBLIC_APP_ENV: "production", NODE_ENV: "production" }, () =>
    loadConfig(),
  );

  // Every permission the EAS pre-install hook strips from the native manifest must
  // also be blocked at config level, so manifest merging cannot reintroduce it.
  const hookSource = read("scripts/configure-eas-native-profile.mjs");
  const removedBlock = hookSource.match(/REMOVED_ANDROID_PERMISSIONS = new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(removedBlock, "EAS hook declares REMOVED_ANDROID_PERMISSIONS");
  const hookRemoved = [...removedBlock[1].matchAll(/"(android\.permission\.[A-Z_]+)"/g)].map(
    (match) => match[1],
  );
  assert.ok(hookRemoved.length > 0);

  // Development keeps app.json's base block list; released profiles extend it.
  const baseBlocked = development.android?.blockedPermissions ?? [];
  for (const config of [staging, production]) {
    for (const permission of baseBlocked) {
      assert.ok(
        config.android?.blockedPermissions?.includes(permission),
        `released config must keep base-blocked ${permission}`,
      );
    }
  }
  for (const config of [staging, production]) {
    const kept = config.android?.permissions ?? [];
    const blocked = config.android?.blockedPermissions ?? [];
    for (const permission of [
      ...hookRemoved,
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_AUDIO",
      "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.USE_BIOMETRIC",
    ]) {
      assert.ok(blocked.includes(permission), `${permission} must be blocked in release`);
    }
    for (const permission of kept) {
      assert.equal(blocked.includes(permission), false, `${permission} is both kept and blocked`);
    }
    assert.equal(blocked.includes("android.permission.ACCESS_NETWORK_STATE"), false);
    const imagePicker = (config.plugins ?? []).find(
      (plugin) => Array.isArray(plugin) && plugin[0] === "expo-image-picker",
    ) as [string, Record<string, unknown>] | undefined;
    assert.equal(typeof imagePicker?.[1].cameraPermission, "string");
    assert.equal(imagePicker?.[1].microphonePermission, false);
  }
});

test("EAS pre-install strips release-only native capabilities in its isolated worktree", () => {
  const fixture = mkdtempSync(join(tmpdir(), "hungry-native-profile-"));
  try {
    mkdirSync(join(fixture, "ios", "Hungry"), { recursive: true });
    mkdirSync(join(fixture, "android", "app", "src", "main"), { recursive: true });
    copyFileSync(join(root, "package.json"), join(fixture, "package.json"));
    copyFileSync(
      join(root, "ios", "Hungry", "Info.plist"),
      join(fixture, "ios", "Hungry", "Info.plist"),
    );
    copyFileSync(
      join(root, "android", "app", "src", "main", "AndroidManifest.xml"),
      join(fixture, "android", "app", "src", "main", "AndroidManifest.xml"),
    );
    writeFileSync(join(fixture, "package-lock.json"), "{}\n");

    execFileSync(process.execPath, [join(root, "scripts", "configure-eas-native-profile.mjs")], {
      cwd: fixture,
      env: { ...process.env, EXPO_PUBLIC_APP_ENV: "staging", EAS_BUILD_PLATFORM: "android" },
      stdio: "pipe",
    });

    const packageJson = JSON.parse(readFileSync(join(fixture, "package.json"), "utf8")) as {
      expo?: { autolinking?: { exclude?: string[] } };
    };
    const plist = readFileSync(join(fixture, "ios", "Hungry", "Info.plist"), "utf8");
    const manifest = readFileSync(
      join(fixture, "android", "app", "src", "main", "AndroidManifest.xml"),
      "utf8",
    );

    assert.deepEqual(packageJson.expo?.autolinking?.exclude, [
      "expo-audio",
      "expo-dev-client",
      "expo-video",
    ]);
    assert.equal(plist.includes("NSMicrophoneUsageDescription"), false);
    assert.equal(plist.includes("NSCameraUsageDescription"), true);
    assert.equal(plist.includes("NSPhotoLibraryUsageDescription"), true);
    assert.equal(manifest.includes("android.permission.CAMERA"), true);
    for (const value of [
      "android.permission.RECORD_AUDIO",
      "READ_MEDIA_IMAGES",
      "READ_MEDIA_VIDEO",
      "AudioControlsService",
    ]) {
      assert.equal(manifest.includes(value), false);
    }
    assert.equal(manifest.includes("android.permission.ACCESS_FINE_LOCATION"), true);
  } finally {
    rmSync(fixture, { force: true, recursive: true });
  }
});

test("EAS archive excludes non-runtime catalog and QA material without excluding build inputs", () => {
  const ignore = read(".easignore");

  for (const excluded of [".claude/", "data/", "marketing/", "supabase/", "tasks/", "tests/"]) {
    assert.match(ignore, new RegExp(`^${excluded.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`, "m"));
  }

  for (const requiredInput of ["src/", "assets/", "scripts/", "android/", "ios/"]) {
    assert.doesNotMatch(
      ignore,
      new RegExp(`^${requiredInput.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`, "m"),
      `${requiredInput} must remain in the EAS build context`,
    );
  }
});

test("released updates use the matching EAS environment and never retain E2E inputs", () => {
  const publisher = join(root, "scripts", "publish-eas-update.mjs");
  for (const [profile, expected] of [
    ["internal-alpha", { appEnv: "staging", channel: "internal-alpha", environment: "preview" }],
    ["preview", { appEnv: "staging", channel: "preview", environment: "preview" }],
    ["production", { appEnv: "production", channel: "production", environment: "production" }],
  ] as const) {
    const output = execFileSync(process.execPath, [publisher, profile, "--print-config"], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE: "mock",
        HUNGRY_EXPO_E2E_WEBSERVER: "1",
      },
    });
    assert.deepEqual(JSON.parse(output), {
      ...expected,
      e2eDataSource: null,
      e2eWebserver: null,
      source: "supabase",
    });
  }
});

test("every EAS build profile pins the iOS build image to an Xcode 26 image", () => {
  // iOS 27 SDK (Xcode 27) builds crash at launch until the app adopts the UIScene lifecycle
  // (Expo SDK 57.0.23+/58). Keep an explicit Xcode 26 image so builds cannot drift to Xcode 27.
  const eas = JSON.parse(read("eas.json")) as {
    build: Record<string, { ios?: { image?: string } }>;
  };

  const profiles = Object.keys(eas.build);
  assert.ok(profiles.length > 0);
  for (const profile of profiles) {
    const image = eas.build[profile]?.ios?.image;
    assert.match(image ?? "", /^macos-[a-z]+-[\d.]+-xcode-26(\.\d+)*$/, `${profile} ios.image`);
  }
});
