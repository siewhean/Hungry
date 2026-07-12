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
  assert.match(
    packageJson,
    /"smoke:native:ios:chat": "node scripts\/run-maestro-smoke\.mjs ios-chat"/,
  );
  assert.match(
    packageJson,
    /"smoke:native:ios:prepared": "node scripts\/prepare-maestro-smoke\.mjs ios"/,
  );
  assert.match(
    packageJson,
    /"smoke:native:ios:chat:prepared": "node scripts\/prepare-maestro-smoke\.mjs ios-chat"/,
  );
  assert.match(
    packageJson,
    /"smoke:native:ios:media:prepared": "node scripts\/prepare-maestro-smoke\.mjs ios-media"/,
  );
  assert.match(
    packageJson,
    /"smoke:native:ios:media": "node scripts\/run-maestro-smoke\.mjs ios-media"/,
  );
  assert.match(runner, /HUNGRY_NATIVE_APP_ID/);
  assert.match(runner, /HUNGRY_MAESTRO_REQUIRED/);
  assert.match(runner, /DEFAULT_METRO_STATUS_URLS = \[/);
  assert.match(runner, /"http:\/\/127\.0\.0\.1:8081\/status"/);
  assert.match(runner, /"http:\/\/localhost:8081\/status"/);
  assert.match(runner, /DEFAULT_METRO_URL = "exp:\/\/localhost:8081"/);
  assert.match(runner, /HUNGRY_NATIVE_SMOKE_METRO_STATUS_URL/);
  assert.match(runner, /HUNGRY_NATIVE_SMOKE_METRO_URL/);
  assert.match(runner, /HUNGRY_NATIVE_SMOKE_SKIP_METRO_CHECK/);
  assert.match(runner, /packager-status:running/);
  assert.match(
    runner,
    /Start `HUNGRY_METRO_USE_WATCHMAN=0 npm run start -- --host lan --port 8081`/,
  );
  assert.match(runner, /HUNGRY_NATIVE_SMOKE_METRO_STATUS_URL/);
  assert.match(runner, /maestro", \["--version"\]/);
  assert.match(runner, /skipped; Maestro CLI is not installed or not on PATH/);
  assert.match(runner, /appJson\.expo\?\.ios\?\.bundleIdentifier/);
  assert.match(runner, /APP_ID=\$\{appId\}/);
  assert.match(runner, /replaceAll\("\$\{METRO_URL\}", metroUrl\)/);
  assert.match(runner, /mkdtempSync/);
  assert.match(runner, /\.maestro\/ios-chat-smoke\.yaml/);
  assert.match(runner, /\.maestro\/ios-media-picker-permission\.yaml/);
  assert.match(preparedRunner, /HUNGRY_NATIVE_SMOKE_CACHE_DIR/);
  assert.match(preparedRunner, /\/private\/tmp\/hungry-native-smoke-tools/);
  assert.match(preparedRunner, /hungry-native-smoke-tools/);
  assert.match(preparedRunner, /\.download/);
  assert.match(preparedRunner, /maestro\/releases\/latest\/download\/maestro\.zip/);
  assert.match(preparedRunner, /api\.adoptium\.net\/v3\/binary\/latest\/17/);
  assert.match(preparedRunner, /scripts\/run-maestro-smoke\.mjs/);
  assert.match(preparedRunner, /--require-maestro/);
  assert.match(preparedRunner, /MAESTRO_CLI_NO_ANALYTICS/);
  assert.match(metroConfig, /HUNGRY_METRO_USE_WATCHMAN/);
  assert.match(metroConfig, /config\.resolver\.useWatchman = false/);
});

test("native activity smoke exposes the audited direct-message tab", () => {
  const flow = read(".maestro/ios-chat-smoke.yaml");
  const activity = read("src/app/screens/home/ActivityInboxScreen.tsx");
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");

  assert.match(flow, /appId: \$\{APP_ID\}/);
  assert.match(flow, /text: "Hungry, http:\/\/\.\*:8081"/);
  assert.match(flow, /text: "Hungry"\n\s+optional: true/);
  assert.match(flow, /text: "Continue"/);
  assert.match(flow, /text: "Close"/);
  assert.match(flow, /visible: "Enter URL manually"/);
  assert.match(flow, /point: "50%,34%"/);
  assert.match(flow, /inputText: "\$\{METRO_URL\}"/);
  assert.match(flow, /tapOn: "Connect"/);
  assert.match(flow, /text: "Close"[\s\S]*optional: true[\s\S]*extendedWaitUntil/);
  assert.match(flow, /extendedWaitUntil:\n\s+visible: "Developer Launcher"\n\s+timeout: 60000/);
  assert.match(flow, /id: "dev-button-activity"/);
  assert.match(flow, /waitForAnimationToEnd:\n\s+timeout: 3000/);
  assert.match(
    flow,
    /extendedWaitUntil:\n\s+visible:\n\s+id: "activity-tab-messages"\n\s+timeout: 30000/,
  );
  assert.match(home, /testID="home-activity-inbox-button"/);
  const developerLauncher = read("src/app/screens/dev/DeveloperLauncherScreen.tsx");
  assert.match(developerLauncher, /label="Activity"[\s\S]*onPress=\{openActivityInboxSmoke\}/);
  assert.match(
    developerLauncher,
    /openActivityInboxSmoke[\s\S]*navigation\.navigate\("ActivityInbox", \{ initialTab: "messages" \}\)/,
  );
  assert.match(flow, /assertVisible:\n\s+id: "activity-tab-messages"/);
  assert.match(flow, /activity-tab-messages/);
  assert.doesNotMatch(flow, /activity-chat-row-1/);
  assert.doesNotMatch(flow, /chat-detail-screen/);
  assert.doesNotMatch(flow, /chat-message-input/);
  assert.doesNotMatch(flow, /chat-send-message/);

  assert.match(activity, /testID=\{`activity-tab-\$\{tab\}`\}/);
  assert.match(
    activity,
    /FEATURE_FLAGS\.directMessagesEnabled\s+\?\s+\["messages", "updates"\]\s+:\s+\["updates"\]/,
  );
});

test("native guest and location flows seed the mock session before entering Home", () => {
  for (const flowPath of [
    ".maestro/ios-guest-browse-smoke.yaml",
    ".maestro/android-guest-browse-smoke.yaml",
    ".maestro/ios-location-denied-smoke.yaml",
  ]) {
    const flow = read(flowPath);
    assert.match(flow, /scrollUntilVisible:\n\s+element:\n\s+id: "dev-section-toggle-session-presets"/);
    assert.match(flow, /scrollUntilVisible:\n\s+element:\n\s+id: "dev-button-home"/);
    assert.match(flow, /id: "dev-section-toggle-session-presets"/);
    assert.match(flow, /id: "dev-button-auth-onboard"/);
    assert.match(flow, /id: "dev-button-home"/);
    assert.doesNotMatch(flow, /id: "dev-button-user"/);
  }
});

test("native media picker smoke reaches the post composer gallery entry point", () => {
  const flow = read(".maestro/ios-media-picker-permission.yaml");
  const composer = read("src/app/screens/post/PostComposerScreenV2.tsx");
  const mediaManager = read("src/features/post/components/MediaManager.tsx");

  assert.match(flow, /appId: \$\{APP_ID\}/);
  assert.match(flow, /permissions:\n\s+all: deny/);
  assert.match(flow, /text: "Hungry, http:\/\/\.\*:8081"/);
  assert.match(flow, /text: "Continue"/);
  assert.match(flow, /text: "Close"/);
  assert.match(flow, /visible: "Enter URL manually"/);
  assert.match(flow, /point: "50%,34%"/);
  assert.match(flow, /inputText: "\$\{METRO_URL\}"/);
  assert.match(flow, /tapOn: "Connect"/);
  assert.match(flow, /text: "Close"[\s\S]*optional: true[\s\S]*extendedWaitUntil/);
  assert.match(flow, /extendedWaitUntil:\n\s+visible: "Developer Launcher"\n\s+timeout: 60000/);
  assert.match(flow, /dev-section-toggle-post-composer-v2-settings/);
  assert.match(flow, /dev-button-launch-v2-composer/);
  assert.match(flow, /post-composer-screen/);
  assert.match(flow, /post-composer-add-media/);
  assert.match(flow, /text: "Allow"\n\s+optional: true/);
  assert.match(flow, /Don.t Allow/);
  assert.match(flow, /Permission Required/);
  const addMediaIndex = flow.indexOf('id: "post-composer-add-media"');
  const allowIndex = flow.indexOf('text: "Allow"');
  const denialIndex = flow.indexOf('text: "Don’t Allow"');
  const permissionRequiredIndex = flow.indexOf('assertVisible: "Permission Required"');
  assert.ok(addMediaIndex >= 0);
  assert.ok(allowIndex > addMediaIndex);
  assert.ok(denialIndex > allowIndex);
  assert.ok(permissionRequiredIndex > allowIndex);

  assert.match(composer, /testID="post-composer-screen"/);
  assert.match(mediaManager, /import \* as ImagePicker from "expo-image-picker"/);
  assert.match(mediaManager, /requestMediaLibraryPermissionsAsync/);
  assert.match(mediaManager, /launchImageLibraryAsync/);
  assert.match(mediaManager, /mediaTypes: ImagePicker\.MediaTypeOptions\.All/);
  assert.match(mediaManager, /allowsMultipleSelection: true/);
  assert.match(mediaManager, /videoMaxDuration: 60/);
  assert.match(mediaManager, /function ComposerVideoPreview/);
  assert.match(mediaManager, /<VideoView/);
  assert.match(mediaManager, /videoPlayer\.loop = true/);
  assert.match(mediaManager, /player\.addListener\("playToEnd"/);
  assert.match(mediaManager, /accessibilityLabel="Add media from gallery"/);
  assert.match(mediaManager, /testID="post-composer-add-media"/);
});

test("native source-smoke coverage includes gestures, bottom sheets, media, and keyboard-sensitive entry points", () => {
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
  const homeMap = read("src/app/screens/discover/HomeMapScreen.tsx");
  const homeFeed = read("src/app/screens/home/HomeFeedScreen.tsx");
  const reviewComments = read("src/components/social/ReviewCommentsSheet.tsx");
  const mediaFlow = read(".maestro/ios-media-picker-permission.yaml");
  const chatFlow = read(".maestro/ios-chat-smoke.yaml");

  assert.match(
    rootNavigator,
    /getComponent=\{loadHomeMapScreen\}[\s\S]*name="DiscoverMap"[\s\S]*gestureEnabled: true/,
  );
  assert.match(homeMap, /edgeBackPanResponder/);
  assert.match(homeMap, /gestureState\.dx > 64 \|\| gestureState\.vx > 0\.35/);
  assert.match(homeFeed, /<BottomSheetModal/);
  assert.match(homeFeed, /<BottomSheetFooter/);
  assert.match(homeFeed, /<Input/);
  assert.match(reviewComments, /<BottomSheetModal/);
  assert.match(reviewComments, /<BottomSheetFooter/);
  assert.match(reviewComments, /<Input/);
  assert.match(reviewComments, /keyboardBehavior="extend"/);
  assert.match(mediaFlow, /post-composer-add-media/);
  assert.match(mediaFlow, /Permission Required/);
  assert.match(chatFlow, /id: "activity-tab-updates"/);
});
