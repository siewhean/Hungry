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
  const removedPlugins = ["expo-dev-client", "expo-audio", "expo-video", "@rnmapbox/maps"];
  const removedKeys = [
    "NSCameraUsageDescription",
    "NSMicrophoneUsageDescription",
    "NSPhotoLibraryAddUsageDescription",
  ];

  assert.equal(pluginNames(development).includes("expo-dev-client"), true);
  for (const config of [staging, production]) {
    assert.equal(config.extra?.e2eDeveloperLauncherEnabled, false);
    assert.deepEqual(config.android?.permissions, [
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.INTERNET",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.VIBRATE",
    ]);
    assert.equal(config.ios?.infoPlist?.NSLocationWhenInUseUsageDescription !== undefined, true);
    for (const plugin of removedPlugins) assert.equal(pluginNames(config).includes(plugin), false);
    for (const key of removedKeys) assert.equal(key in (config.ios?.infoPlist ?? {}), false);
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
      "@rnmapbox/maps",
      "expo-audio",
      "expo-dev-client",
      "expo-video",
    ]);
    for (const value of ["NSCameraUsageDescription", "NSMicrophoneUsageDescription"]) {
      assert.equal(plist.includes(value), false);
    }
    assert.equal(plist.includes("NSPhotoLibraryUsageDescription"), true);
    for (const value of [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "READ_MEDIA_VIDEO",
      "AudioControlsService",
    ]) {
      assert.equal(manifest.includes(value), false);
    }
    assert.equal(manifest.includes("android.permission.ACCESS_FINE_LOCATION"), true);
    assert.equal(manifest.includes("android.permission.READ_MEDIA_IMAGES"), true);
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
