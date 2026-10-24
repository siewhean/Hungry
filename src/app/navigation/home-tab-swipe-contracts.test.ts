import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

// HOME-9: with the social feed off, the pager page after Discover is the Home redirect, so a
// swipe from Discover bounced straight back. Discover must not take pager swipes then.
test("Discover takes pager swipes only while the feed (the next page) is a real tab", () => {
  const tabs = fs.readFileSync("src/app/navigation/SwipeableTabNavigator.tsx", "utf8");
  assert.match(
    tabs,
    /name="Discover"\s*component=\{DiscoverWrapper\}\s*options=\{\{ swipeEnabled: FEATURE_FLAGS\.socialFeedEnabled \}\}/,
  );
  assert.match(tabs, /FEATURE_FLAGS\.socialFeedEnabled \? HomeWrapper : ReleaseLandingRedirect/);
});
