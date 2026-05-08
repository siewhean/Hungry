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

  assert.match(packageJson, /"smoke:native": "node scripts\/run-maestro-smoke\.mjs ios"/);
  assert.match(packageJson, /"smoke:native:ios": "node scripts\/run-maestro-smoke\.mjs ios"/);
  assert.match(
    packageJson,
    /"smoke:native:ios:chat": "node scripts\/run-maestro-smoke\.mjs ios-chat"/,
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
});

test("native chat smoke is text-only and uses stable selectors", () => {
  const flow = read(".maestro/ios-chat-smoke.yaml");
  const chat = read("src/app/screens/home/ChatDetailScreen.tsx");
  const activity = read("src/app/screens/home/ActivityInboxScreen.tsx");
  const activityContracts = read("src/app/navigation/nav-activity-contracts.test.ts");

  assert.match(flow, /appId: \$\{APP_ID\}/);
  assert.match(flow, /dev-button-auth-onboard/);
  assert.match(flow, /dev-button-home/);
  assert.match(flow, /Open activity inbox/);
  assert.match(flow, /activity-tab-messages/);
  assert.match(flow, /activity-chat-row-1/);
  assert.match(flow, /chat-detail-screen/);
  assert.match(flow, /Text messages only for now\./);
  assert.match(flow, /assertNotVisible: "Add media"/);
  assert.match(flow, /chat-message-input/);
  assert.match(flow, /chat-send-message/);

  assert.match(activity, /testID=\{`activity-tab-\$\{tab\}`\}/);
  assert.match(activity, /testID=\{`activity-chat-row-\$\{chatId\}`\}/);
  assert.match(chat, /testID="chat-detail-screen"/);
  assert.match(chat, /testID="chat-text-only-copy"/);
  assert.match(chat, /testID="chat-message-list"/);
  assert.match(chat, /chat-message-sent/);
  assert.match(chat, /chat-message-received/);
  assert.match(chat, /accessibilityLabel="Message input"/);
  assert.match(chat, /testID="chat-message-input"/);
  assert.match(chat, /testID="chat-send-message"/);
  assert.match(activityContracts, /assert\.doesNotMatch\(chat, \/ImagePicker\/\)/);
  assert.doesNotMatch(chat, /ImagePicker/);
  assert.doesNotMatch(chat, /Paperclip/);
});

test("native media picker smoke reaches the post composer gallery entry point", () => {
  const flow = read(".maestro/ios-media-picker-permission.yaml");
  const composer = read("src/app/screens/post/PostComposerScreenV2.tsx");
  const mediaManager = read("src/features/post/components/MediaManager.tsx");

  assert.match(flow, /appId: \$\{APP_ID\}/);
  assert.match(flow, /permissions:\n\s+all: deny/);
  assert.match(flow, /dev-button-auth-onboard/);
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
