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
