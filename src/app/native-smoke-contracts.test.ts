import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("native Maestro smoke scripts are skip-safe and target the Hungry app id", () => {
  const packageJson = read("package.json");
  const runner = read("scripts/run-maestro-smoke.mjs");
  const preparedRunner = read("scripts/prepare-maestro-smoke.mjs");

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
  assert.match(runner, /maestro", \["--version"\]/);
  assert.match(runner, /skipped; Maestro CLI is not installed or not on PATH/);
  assert.match(runner, /appJson\.expo\?\.ios\?\.bundleIdentifier/);
  assert.match(runner, /APP_ID=\$\{appId\}/);
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
});

test("native activity smoke respects direct-message gating", () => {
  const flow = read(".maestro/ios-chat-smoke.yaml");
  const activity = read("src/app/screens/home/ActivityInboxScreen.tsx");
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");

  assert.match(flow, /appId: \$\{APP_ID\}/);
  assert.match(flow, /text: "Hungry, http:\/\/\.\*:8081"/);
  assert.match(flow, /text: "Hungry"\n\s+optional: true/);
  assert.match(flow, /text: "Continue"/);
  assert.match(flow, /text: "Close"/);
  assert.match(flow, /extendedWaitUntil:\n\s+visible: "Developer Launcher"\n\s+timeout: 60000/);
  assert.match(flow, /id: "dev-button-developer"/);
  assert.match(flow, /Open normal app flow/);
  assert.match(flow, /home-activity-inbox-button/);
  assert.match(
    flow,
    /extendedWaitUntil:\n\s+visible:\n\s+id: "home-activity-inbox-button"\n\s+timeout: 30000/,
  );
  assert.match(flow, /waitForAnimationToEnd:\n\s+timeout: 5000/);
  assert.match(flow, /waitForAnimationToEnd:\n\s+timeout: 3000/);
  assert.match(flow, /text: "Close"\n\s+optional: true/);
  assert.match(flow, /id: "home-activity-inbox-button"\n\s+optional: true/);
  assert.match(
    flow,
    /extendedWaitUntil:\n\s+visible:\n\s+id: "activity-tab-updates"\n\s+timeout: 30000/,
  );
  assert.match(home, /testID="home-activity-inbox-button"/);
  assert.match(flow, /assertNotVisible:\n\s+id: "activity-tab-messages"/);
  assert.match(flow, /activity-tab-messages/);
  assert.doesNotMatch(flow, /activity-chat-row-1/);
  assert.doesNotMatch(flow, /chat-detail-screen/);
  assert.doesNotMatch(flow, /chat-message-input/);
  assert.doesNotMatch(flow, /chat-send-message/);

  assert.match(activity, /testID=\{`activity-tab-\$\{tab\}`\}/);
  assert.match(
    activity,
    /FEATURE_FLAGS\.directMessagesEnabled \? \["messages", "updates"\] : \["updates"\]/,
  );
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
  assert.match(flow, /extendedWaitUntil:\n\s+visible: "Developer Launcher"\n\s+timeout: 60000/);
  assert.match(flow, /dev-button-launch-v2-composer/);
  assert.match(flow, /post-composer-screen/);
  assert.match(flow, /post-composer-add-media/);
  assert.match(flow, /Don.t Allow/);
  assert.match(flow, /Permission Required/);

  assert.match(composer, /testID="post-composer-screen"/);
  assert.match(mediaManager, /import \* as ImagePicker from "expo-image-picker"/);
  assert.match(mediaManager, /requestMediaLibraryPermissionsAsync/);
  assert.match(mediaManager, /launchImageLibraryAsync/);
  assert.match(mediaManager, /mediaTypes: ImagePicker\.MediaTypeOptions\.All/);
  assert.match(mediaManager, /allowsMultipleSelection: true/);
  assert.match(mediaManager, /accessibilityLabel="Add media from gallery"/);
  assert.match(mediaManager, /testID="post-composer-add-media"/);
});
