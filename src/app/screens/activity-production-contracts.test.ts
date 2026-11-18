import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("direct messages are gone from the inbox, the share sheets and the navigator", () => {
  const activity = read("src/app/screens/home/ActivityInboxScreen.tsx");
  const reviewShare = read("src/app/screens/review/ReviewShareSheet.tsx");
  const profile = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");

  assert.doesNotMatch(activity, /\.chat\b|ChatDetail|MessagesTab|activity-tab-messages/);
  assert.doesNotMatch(rootNavigator, /ChatDetail|DirectMessages/);
  for (const source of [reviewShare, profile]) {
    assert.doesNotMatch(source, /sharePostToChat|shareRecipients|FloatingShareSendButton/);
  }
});

test("activity updates avoid per-row repository scans and token leaks", () => {
  const activity = read("src/app/screens/home/ActivityInboxScreen.tsx");

  assert.match(activity, /const postById = useMemo/);
  assert.match(activity, /postById\.get\(update\.postId\)/);
  assert.doesNotMatch(activity, /posts\.find/);
  assert.doesNotMatch(activity, /#FFFFFF/);
});
