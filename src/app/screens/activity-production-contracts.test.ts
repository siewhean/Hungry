import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("activity inbox hides message surfaces when direct messages are disabled", () => {
  const activity = read("src/app/screens/home/ActivityInboxScreen.tsx");
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  const reviewShare = read("src/app/screens/review/ReviewShareSheet.tsx");
  const profile = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");

  assert.match(
    activity,
    /FEATURE_FLAGS\.directMessagesEnabled\s+\?\s+\["messages", "updates"\]\s+:\s+\["updates"\]/,
  );
  assert.match(activity, /route\.params\?\.initialTab === "messages"/);
  assert.match(activity, /if \(!FEATURE_FLAGS\.directMessagesEnabled\)/);
  assert.match(rootNavigator, /FEATURE_FLAGS\.directMessagesEnabled \? \(/);
  assert.match(rootNavigator, /name="ChatDetail"/);
  assert.match(rootNavigator, /name="DirectMessages"/);
  for (const source of [home, reviewShare, profile]) {
    assert.match(source, /if \(!FEATURE_FLAGS\.directMessagesEnabled\)/);
    assert.match(source, /directMessagesEnabled \? shareRecipients : \[\]/);
    assert.match(source, /footerComponent=\{\s*directMessagesEnabled/);
  }
});

test("activity updates avoid per-row repository scans and token leaks", () => {
  const activity = read("src/app/screens/home/ActivityInboxScreen.tsx");

  assert.match(activity, /const postById = useMemo/);
  assert.match(activity, /postById\.get\(update\.postId\)/);
  assert.doesNotMatch(activity, /posts\.find/);
  assert.doesNotMatch(activity, /#FFFFFF/);
  assert.match(activity, /textColor=\{palette\.white\}/);
});
