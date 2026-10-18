import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function readRepoFile(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

// android/ and ios/ are committed, so EAS and local builds use them as-is instead of
// regenerating them from app.json. Keep the two in sync by hand.
test("committed Android manifest strips every permission app.json blocks", () => {
  const appConfig = JSON.parse(readRepoFile("app.json"));
  const manifest = readRepoFile("android/app/src/main/AndroidManifest.xml");
  const blocked: string[] = appConfig.expo.android.blockedPermissions;

  assert.ok(blocked.includes("android.permission.RECORD_AUDIO"));
  for (const permission of blocked) {
    assert.match(
      manifest,
      new RegExp(`<uses-permission android:name="${permission}" tools:node="remove"/>`),
      `${permission} must be removed in AndroidManifest.xml`,
    );
  }
  assert.doesNotMatch(manifest, /android\.permission\.SYSTEM_ALERT_WINDOW/);
  assert.doesNotMatch(manifest, /AudioControlsService/);
});

test("committed iOS Info.plist does not request background audio", () => {
  const infoPlist = readRepoFile("ios/Hungry/Info.plist");

  assert.doesNotMatch(
    infoPlist,
    /<key>UIBackgroundModes<\/key>\s*<array>\s*<string>audio<\/string>/,
  );
});

test("committed iOS Info.plist does not ask for Always location or the microphone", () => {
  const appConfig = JSON.parse(readRepoFile("app.json"));
  const infoPlist = readRepoFile("ios/Hungry/Info.plist");

  // The app only uses foreground location and never records audio (camera capture is images only).
  assert.doesNotMatch(infoPlist, /NSLocationAlwaysUsageDescription/);
  assert.doesNotMatch(infoPlist, /NSLocationAlwaysAndWhenInUseUsageDescription/);
  assert.doesNotMatch(infoPlist, /NSMicrophoneUsageDescription/);
  assert.equal("NSMicrophoneUsageDescription" in appConfig.expo.ios.infoPlist, false);

  // Keep config plugins from re-adding the keys on a future `expo prebuild`.
  const pluginOptions = (name: string) =>
    appConfig.expo.plugins.find(
      (plugin: unknown) => Array.isArray(plugin) && plugin[0] === name,
    )?.[1];
  assert.equal(pluginOptions("expo-location")?.locationAlwaysPermission, false);
  assert.equal(pluginOptions("expo-location")?.locationAlwaysAndWhenInUsePermission, false);
  assert.equal(pluginOptions("expo-image-picker")?.microphonePermission, false);
  assert.equal(pluginOptions("expo-audio")?.microphonePermission, false);
});

test("OTA runtime version uses the fingerprint policy in app.json and both native projects", () => {
  const appConfig = JSON.parse(readRepoFile("app.json"));
  assert.deepEqual(appConfig.expo.runtimeVersion, { policy: "fingerprint" });
  assert.match(
    readRepoFile("ios/Hungry/Supporting/Expo.plist"),
    /<key>EXUpdatesRuntimeVersion<\/key>\s*<string>file:fingerprint<\/string>/,
  );
  assert.match(
    readRepoFile("android/app/src/main/res/values/strings.xml"),
    /<string name="expo_runtime_version">file:fingerprint<\/string>/,
  );
});
