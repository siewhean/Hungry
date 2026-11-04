import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

// A drag-along pager fought the photo carousels, so the tabs open from the tab bar or a swipe in
// from a screen edge. The pages slide across when they change (animationEnabled), so a swipe shows
// the move between pages instead of just changing the screen; Reduce Motion cuts. This also covers
// HOME-9: with the social feed off, a swipe from Discover bounced straight back from the Home
// redirect.
test("the main tabs take no pager swipes and the pages slide across when a tab opens", () => {
  const tabs = fs.readFileSync("src/app/navigation/SwipeableTabNavigator.tsx", "utf8");
  assert.match(tabs, /screenOptions=\{\{[\s\S]*?swipeEnabled: false/);
  assert.doesNotMatch(tabs, /swipeEnabled: FEATURE_FLAGS/);
  assert.match(tabs, /animationEnabled: !reduceMotion/);
  assert.doesNotMatch(tabs, /useFadeRiseIn/, "the old rise would play on top of the slide");
  assert.match(tabs, /FEATURE_FLAGS\.socialFeedEnabled \? HomeWrapper : ReleaseLandingRedirect/);
});

// Swiping on through the Post card (Home, Post, Reviews, Profile) has to pick the page under it.
test("a swipe from the Post card returns to the tab bar under it and picks the page", () => {
  const post = fs.readFileSync("src/app/screens/review/ReviewScreen.tsx", "utf8");
  assert.match(post, /rootNavigation\.popTo\("MainTabs", \{ screen: target \}/);
  assert.doesNotMatch(post, /rootNavigation\.navigate\("MainTabs", \{ screen: target/);
  assert.match(post, /onSwipeFromLeft: goToTab\("previous"\)/);
  assert.match(post, /onSwipeFromRight: goToTab\("next"\)/);
});
