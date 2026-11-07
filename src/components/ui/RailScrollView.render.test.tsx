// Home's sideways scroller. Run with
// `HUNGRY_DATA_SOURCE=mock node scripts/test-render.mjs src/components/ui/RailScrollView.render.test.tsx`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach } from "node:test";
import { Text } from "react-native";

import { cleanup, render } from "@/test/render";

import { RailScrollView } from "./RailScrollView";

afterEach(cleanup);

test("RailScrollView shows its children in a sideways scroller", async () => {
  const view = await render(
    <RailScrollView horizontal testID="rail">
      <Text>First card</Text>
      <Text>Second card</Text>
    </RailScrollView>,
  );
  assert.ok(view.findByTestId("rail"), "the scroller renders");
  assert.match(view.text(), /First card/);
  assert.match(view.text(), /Second card/);
});

test("on a phone it is gesture-handler's ScrollView, so two rows can be swiped at once", () => {
  const source = readFileSync("src/components/ui/RailScrollView.tsx", "utf8");
  assert.match(source, /Platform\.OS === "web" \? NativeScrollView : GestureScrollView/);
  // Home's rows, the Home chips and the dish rails all use it rather than the plain ScrollView.
  const home = readFileSync("src/app/screens/discover/DiscoverHomeScreen.tsx", "utf8");
  assert.doesNotMatch(home, /<ScrollView\s+horizontal/);
  const chips = readFileSync("src/components/ui/FilterChipRail.tsx", "utf8");
  assert.match(chips, /<RailScrollView/);
  const rail = readFileSync("src/components/discover/home/DiscoverBiteRail.tsx", "utf8");
  assert.doesNotMatch(rail, /<ScrollView\s+horizontal/);
});

test("RailScrollView lets a tap reach a card while the row is still sliding", () => {
  const source = readFileSync("src/components/ui/RailScrollView.tsx", "utf8");
  assert.match(source, /allowTapsWhileScrolling: true/);
  const patch = readFileSync("patches/react-native+0.86.3.patch", "utf8");
  assert.match(patch, /this\._isAnimating\(\) && this\.props\.allowTapsWhileScrolling !== true/);
});

test("a tap on a sliding sideways row is let through natively, not only in JS", () => {
  // UIKit keeps the touch that lands on a decelerating scroll view, so the JS prop alone cannot
  // work: the patch also stops the slide in the scroll view's hit test and reports its end.
  const patch = readFileSync("patches/react-native+0.86.3.patch", "utf8");
  assert.match(patch, /RCTScrollViewComponentView\.mm/);
  assert.match(patch, /\+- \(UIView \*\)hitTest:\(CGPoint\)point withEvent:\(UIEvent \*\)event/);
  assert.match(patch, /_scrollView\.isDecelerating && !_scrollView\.isTracking/);
  assert.match(patch, /\+\s+\[self scrollViewDidEndDecelerating:_scrollView\];/);
  // Every sideways row of cards or chips uses the scroller that carries the prop.
  for (const file of [
    "src/components/discover/TrendingList.tsx",
    "src/components/discover/WhatsHerePanel.tsx",
  ]) {
    assert.match(readFileSync(file, "utf8"), /<RailScrollView/, file);
  }
  const home = readFileSync("src/app/screens/discover/DiscoverHomeScreen.tsx", "utf8");
  assert.match(home, /\{\.\.\.TAPS_WHILE_SCROLLING\}/);
});

test("the Popular dishes row is flush with the page margin without negative margins inside the scroller", () => {
  const home = readFileSync("src/app/screens/discover/DiscoverHomeScreen.tsx", "utf8");
  assert.match(
    home,
    /width: screenWidth \+ FOOD_STYLE_RAIL_INSET,\s+marginLeft: -FOOD_STYLE_RAIL_INSET/,
  );
  const row = home.slice(
    home.indexOf("const foodStyleRowStyle"),
    home.indexOf("const foodStyleScrollStyle"),
  );
  assert.doesNotMatch(row, /marginLeft/);
});
