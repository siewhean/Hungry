import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

// Sideways swipes half-drew the neighbouring tab pages, so the tabs open from the tab bar instead
// and each page rises in from the bottom. This also covers HOME-9: with the social feed off, a
// swipe from Discover bounced straight back from the Home redirect.
test("the main tabs take no pager swipes and each page rises in when its tab opens", () => {
  const tabs = fs.readFileSync("src/app/navigation/SwipeableTabNavigator.tsx", "utf8");
  assert.match(tabs, /screenOptions=\{\{[\s\S]*?swipeEnabled: false/);
  assert.doesNotMatch(tabs, /swipeEnabled: FEATURE_FLAGS/);
  assert.match(tabs, /useFadeRiseIn\(reduceMotion, \{[\s\S]*?resetKey: isActiveTab/);
  assert.match(tabs, /FEATURE_FLAGS\.socialFeedEnabled \? HomeWrapper : ReleaseLandingRedirect/);
});
