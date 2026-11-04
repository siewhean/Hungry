import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const tabs = () => fs.readFileSync("src/app/navigation/SwipeableTabNavigator.tsx", "utf8");
const pager = () => fs.readFileSync("src/app/navigation/EdgeSwipeTabs.tsx", "utf8");

// Only a drag from a screen edge moves the pages (the photo carousels keep every other swipe), the
// pages drag along with the finger so both show at once, and the tab bar changes page at once.
// This also covers HOME-9: with the social feed off, the Home redirect route sits after the pages
// in the swipe order, so a drag never uncovers it and bounces straight back.
test("the main pages drag along from the screen edges and the tab bar switches at once", () => {
  const nav = tabs();
  assert.match(nav, /createEdgeSwipeTabNavigator<MainTabParamList>\(\)/);
  assert.doesNotMatch(nav, /createMaterialTopTabNavigator/);
  assert.doesNotMatch(nav, /swipeEnabled: true/);
  assert.match(nav, /pageCount=\{MAIN_TAB_ORDER\.length\}/);
  assert.match(nav, /mountAllPages=\{tabPreloadEnabled\}/);
  assert.match(nav, /reduceMotion=\{reduceMotion\}/);
  assert.doesNotMatch(nav, /useFadeRiseIn/);
  // The redirect routes come after the pages in the declared order.
  const profile = nav.indexOf('<Tab.Screen name="Profile"');
  const redirect = nav.indexOf("component={ReleaseLandingRedirect}");
  assert.ok(profile > 0 && redirect > profile, "redirect routes sit after the pages");
});

test("the edge pager drags the row with the finger and never animates a bar change", () => {
  const view = pager();
  assert.match(view, /onMoveShouldSetPanResponderCapture/);
  assert.match(view, /edgeDragDirection\(/);
  assert.match(view, /panX\.setValue\(current\.startOffset \+ moved\)/);
  assert.match(view, /Animated\.spring\(panX/);
  // A change from the bar sets the offset directly.
  assert.match(view, /panX\.setValue\(-state\.index \* width\)/);
  assert.match(view, /nav\.jumpTo\(s\.routes\[target\]\.name\)/);
});

// Swiping on through the Post card (Home, Post, Reviews, Profile) has to pick the page under it.
test("a swipe from the Post card returns to the tab bar under it and picks the page", () => {
  const post = fs.readFileSync("src/app/screens/review/ReviewScreen.tsx", "utf8");
  assert.match(post, /rootNavigation\.popTo\("MainTabs", \{ screen: target \}/);
  assert.doesNotMatch(post, /rootNavigation\.navigate\("MainTabs", \{ screen: target/);
  assert.match(post, /onSwipeFromLeft: goToTab\("previous"\)/);
  assert.match(post, /onSwipeFromRight: goToTab\("next"\)/);
});
