import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const RELEASED_ENVS = new Set(["staging", "production"]);
const RELEASED_ANDROID_PERMISSIONS = new Set([
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.CAMERA",
  "android.permission.INTERNET",
  "android.permission.VIBRATE",
]);
const REMOVED_ANDROID_PERMISSIONS = new Set([
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.RECORD_AUDIO",
  "android.permission.SYSTEM_ALERT_WINDOW",
  "android.permission.WRITE_EXTERNAL_STORAGE",
]);
const REMOVED_INFO_PLIST_KEYS = [
  "DEV_CLIENT_TRY_TO_LAUNCH_LAST_BUNDLE",
  "NSBonjourServices",
  "NSLocalNetworkUsageDescription",
  "NSLocationAlwaysUsageDescription",
  "NSLocationAlwaysAndWhenInUseUsageDescription",
  "NSFaceIDUsageDescription",
  "NSMicrophoneUsageDescription",
  "NSPhotoLibraryAddUsageDescription",
  "UIBackgroundModes",
  "CADisableMinimumFrameDurationOnPhone",
];
// Capabilities a released iOS build needs: universal links for usehungry.com share links and
// push for stall alerts. They live only in the EAS worktree because the free Personal Team that
// signs local device builds cannot hold them; the committed entitlements file stays empty.
const RELEASED_IOS_ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>aps-environment</key>
    <string>production</string>
    <key>com.apple.developer.associated-domains</key>
    <array>
      <string>applinks:usehungry.com</string>
      <string>applinks:www.usehungry.com</string>
    </array>
  </dict>
</plist>
`;
// @rnmapbox/maps stays linked (owner decision 2026-10-25); keep in step with app.config.js.
const RELEASED_NATIVE_MODULES = ["expo-dev-client", "expo-audio", "expo-video"];

function resolveAppEnv(env) {
  const raw = env.EXPO_PUBLIC_APP_ENV || env.APP_ENV || env.NODE_ENV;
  return raw === "staging" || raw === "production" || raw === "development" ? raw : "development";
}

function releaseProfile(env) {
  const appEnv = resolveAppEnv(env);
  return {
    appEnv,
    isReleased: RELEASED_ENVS.has(appEnv),
    platform: env.EAS_BUILD_PLATFORM ?? null,
    nativeModulesExcluded: RELEASED_ENVS.has(appEnv) ? RELEASED_NATIVE_MODULES : [],
    iosPermissionKeysRemoved: RELEASED_ENVS.has(appEnv) ? REMOVED_INFO_PLIST_KEYS : [],
    androidPermissionsKept: RELEASED_ENVS.has(appEnv)
      ? [...RELEASED_ANDROID_PERMISSIONS].sort()
      : null,
    androidPermissionsRemoved: RELEASED_ENVS.has(appEnv)
      ? [...REMOVED_ANDROID_PERMISSIONS].sort()
      : [],
  };
}

function removePlistEntry(contents, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return contents
    .replace(new RegExp(`\\s*<key>${escapedKey}</key>\\s*<string>[\\s\\S]*?</string>`, "g"), "")
    .replace(new RegExp(`\\s*<key>${escapedKey}</key>\\s*<true\\s*/>`, "g"), "")
    .replace(new RegExp(`\\s*<key>${escapedKey}</key>\\s*<false\\s*/>`, "g"), "")
    .replace(new RegExp(`\\s*<key>${escapedKey}</key>\\s*<array>[\\s\\S]*?</array>`, "g"), "");
}

function writeReleasedPackageJson(root) {
  const packagePath = path.join(root, "package.json");
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  const existingExclude = packageJson.expo?.autolinking?.exclude ?? [];
  packageJson.expo = {
    ...(packageJson.expo ?? {}),
    autolinking: {
      ...(packageJson.expo?.autolinking ?? {}),
      exclude: [...new Set([...existingExclude, ...RELEASED_NATIVE_MODULES])].sort(),
    },
  };
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function writeReleasedInfoPlist(root) {
  const plistPath = path.join(root, "ios", "Hungry", "Info.plist");
  let contents = readFileSync(plistPath, "utf8");
  for (const key of REMOVED_INFO_PLIST_KEYS) {
    contents = removePlistEntry(contents, key);
  }
  writeFileSync(plistPath, contents);
}

function writeReleasedEntitlements(root) {
  const entitlementsPath = path.join(root, "ios", "Hungry", "Hungry.entitlements");
  writeFileSync(entitlementsPath, RELEASED_IOS_ENTITLEMENTS);
}

function writeReleasedAndroidManifest(root) {
  const manifestPath = path.join(root, "android", "app", "src", "main", "AndroidManifest.xml");
  let contents = readFileSync(manifestPath, "utf8");
  for (const permission of REMOVED_ANDROID_PERMISSIONS) {
    const escapedPermission = permission.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    contents = contents.replace(
      new RegExp(`\\s*<uses-permission\\s+android:name="${escapedPermission}"[^>]*/>`, "g"),
      "",
    );
  }
  contents = contents.replace(
    /\s*<service android:name="expo\.modules\.audio\.service\.AudioControlsService"[\s\S]*?<\/service>/g,
    "",
  );
  writeFileSync(manifestPath, contents);
}

function applyReleasedProfile(root, profile) {
  if (!profile.isReleased) return;
  writeReleasedPackageJson(root);
  writeReleasedInfoPlist(root);
  writeReleasedEntitlements(root);
  writeReleasedAndroidManifest(root);
}

const profile = releaseProfile(process.env);
if (process.argv.includes("--print-config")) {
  process.stdout.write(`${JSON.stringify(profile)}\n`);
  process.exit(0);
}

// EAS runs this hook in an isolated uploaded worktree before dependency installation.
// Do not mutate a developer checkout when the hook is invoked outside an EAS platform build.
if (process.env.EAS_BUILD_PLATFORM) {
  applyReleasedProfile(process.cwd(), profile);
  process.stdout.write(
    `Configured ${profile.appEnv} native profile for ${process.env.EAS_BUILD_PLATFORM}.\n`,
  );
}
