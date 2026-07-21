import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("native Maestro smoke scripts are skip-safe and target the Hungry app id", () => {
  const appJson = read("app.json");
  const packageJson = read("package.json");
  const metroConfig = read("metro.config.js");
  const runner = read("scripts/run-maestro-smoke.mjs");
  const preparedRunner = read("scripts/prepare-maestro-smoke.mjs");

  assert.match(appJson, /"@rnmapbox\/maps"/);
  assert.match(appJson, /"RNMapboxMapsVersion": "11\.18\.2"/);
  assert.match(packageJson, /"smoke:native": "node scripts\/run-maestro-smoke\.mjs ios"/);
  assert.match(packageJson, /"smoke:native:ios": "node scripts\/run-maestro-smoke\.mjs ios"/);
  assert.match(packageJson, /smoke:native:ios:mandatory-auth/);
  assert.match(packageJson, /smoke:native:android:mandatory-auth/);
  assert.match(packageJson, /smoke:native:ios:authenticated-fallback/);
  assert.doesNotMatch(packageJson, /smoke:native:(?:ios|android):guest/);

  assert.match(runner, /HUNGRY_NATIVE_APP_ID/);
  assert.match(runner, /HUNGRY_MAESTRO_REQUIRED/);
  assert.match(runner, /HUNGRY_STAGING_EMAIL/);
  assert.match(runner, /HUNGRY_STAGING_PASSWORD/);
  assert.match(runner, /DEFAULT_METRO_STATUS_URLS = \[/);
  assert.match(runner, /"http:\/\/127\.0\.0\.1:8081\/status"/);
  assert.match(runner, /"http:\/\/localhost:8081\/status"/);
  assert.match(runner, /DEFAULT_METRO_URL = "exp:\/\/localhost:8081"/);
  assert.match(runner, /HUNGRY_NATIVE_SMOKE_METRO_STATUS_URL/);
  assert.match(runner, /HUNGRY_NATIVE_SMOKE_METRO_URL/);
  assert.match(runner, /HUNGRY_NATIVE_SMOKE_SKIP_METRO_CHECK/);
  assert.match(runner, /packager-status:running/);
  assert.match(runner, /maestro", \["--version"\]/);
  assert.match(runner, /skipped; Maestro CLI is not installed or not on PATH/);
  assert.match(runner, /appJson\.expo\?\.ios\?\.bundleIdentifier/);
  assert.match(runner, /APP_ID/);
  assert.match(runner, /replaceAll\("\$\{METRO_URL\}", metroUrl\)/);
  assert.match(runner, /mkdtempSync/);
  assert.match(runner, /\.maestro\/ios-mandatory-auth-smoke\.yaml/);
  assert.match(runner, /\.maestro\/android-mandatory-auth-smoke\.yaml/);
  assert.match(runner, /\.maestro\/ios-authenticated-fallback-smoke\.yaml/);
  assert.doesNotMatch(runner, /guest-browse-smoke/);

  assert.match(preparedRunner, /HUNGRY_NATIVE_SMOKE_CACHE_DIR/);
  assert.match(preparedRunner, /\/private\/tmp\/hungry-native-smoke-tools/);
  assert.match(preparedRunner, /maestro\/releases\/latest\/download\/maestro\.zip/);
  assert.match(preparedRunner, /api\.adoptium\.net\/v3\/binary\/latest\/17/);
  assert.match(preparedRunner, /scripts\/run-maestro-smoke\.mjs/);
  assert.match(preparedRunner, /--require-maestro/);
  assert.match(preparedRunner, /MAESTRO_CLI_NO_ANALYTICS/);
  assert.match(metroConfig, /HUNGRY_METRO_USE_WATCHMAN/);
  assert.match(metroConfig, /config\.resolver\.useWatchman = false/);
});

test("mandatory-auth native flows reject guest entry and protected deep-link bypasses", () => {
  for (const flowPath of [
    ".maestro/ios-mandatory-auth-smoke.yaml",
    ".maestro/android-mandatory-auth-smoke.yaml",
  ]) {
    const flow = read(flowPath);
    assert.match(flow, /clearState: true/);
    assert.match(flow, /visible: "Get started"/);
    assert.match(flow, /assertNotVisible: "Continue as Guest"/);
    assert.match(flow, /assertNotVisible: "Skip login"/);
    assert.match(flow, /Already have an account\.\*Sign in/);
    assert.match(flow, /visible: "Welcome back"/);
    assert.match(flow, /openLink: "hungry:\/(?:\/)?(?:dish|venue)\//);
    assert.match(flow, /assertNotVisible: "Discover"/);
  }
});

test("authenticated fallback smoke requires staging credentials and an offline catalog badge", () => {
  const runner = read("scripts/run-maestro-smoke.mjs");
  const flow = read(".maestro/ios-authenticated-fallback-smoke.yaml");
  const discover = read("src/app/screens/discover/CatalogDiscoverHome.tsx");

  assert.match(runner, /ios-authenticated-fallback requires HUNGRY_STAGING_EMAIL/);
  assert.match(flow, /\$\{STAGING_EMAIL\}/);
  assert.match(flow, /\$\{STAGING_PASSWORD\}/);
  assert.match(flow, /id: "catalog-source-excel"/);
  assert.match(flow, /assertVisible: "Offline catalog"/);
  assert.match(discover, /testID=\{isOfflineCatalog \? "catalog-source-excel"/);
  assert.match(discover, /releaseId\?\.startsWith\("excel-fallback"\)/);
});

test("native media and interaction flows remain available as explicit authenticated targets", () => {
  const runner = read("scripts/run-maestro-smoke.mjs");
  const mediaFlow = read(".maestro/ios-media-picker-permission.yaml");
  const interactionFlow = read(".maestro/ios-discovery-search-smoke.yaml");
  const composer = read("src/app/screens/post/PostComposerScreenV2.tsx");
  const mediaManager = read("src/features/post/components/MediaManager.tsx");

  assert.match(runner, /"ios-media": \["\.maestro\/ios-media-picker-permission\.yaml"\]/);
  assert.match(runner, /"ios-interactions": \["\.maestro\/ios-discovery-search-smoke\.yaml"\]/);
  assert.match(mediaFlow, /post-composer-add-media/);
  assert.match(mediaFlow, /Permission Required/);
  assert.match(interactionFlow, /inputText: "Laksa"/);
  assert.match(composer, /testID="post-composer-screen"/);
  assert.match(mediaManager, /requestMediaLibraryPermissionsAsync/);
  assert.match(mediaManager, /launchImageLibraryAsync/);
  assert.match(mediaManager, /accessibilityLabel="Add media from gallery"/);
});

test("native source-smoke coverage still includes gestures and keyboard-aware sheets", () => {
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
  const homeMap = read("src/app/screens/discover/HomeMapScreen.tsx");
  const homeFeed = read("src/app/screens/home/HomeFeedScreen.tsx");
  const reviewComments = read("src/components/social/ReviewCommentsSheet.tsx");

  assert.match(
    rootNavigator,
    /getComponent=\{loadHomeMapScreen\}[\s\S]*name="DiscoverMap"[\s\S]*gestureEnabled: true/,
  );
  assert.match(homeMap, /edgeBackPanResponder/);
  assert.match(homeMap, /gestureState\.dx > 64 \|\| gestureState\.vx > 0\.35/);
  assert.match(homeFeed, /<BottomSheetModal/);
  assert.match(homeFeed, /<BottomSheetFooter/);
  assert.match(reviewComments, /<BottomSheetModal/);
  assert.match(reviewComments, /keyboardBehavior="extend"/);
});
