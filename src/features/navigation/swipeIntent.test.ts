import assert from "node:assert/strict";
import test from "node:test";

import { adjacentTabKey, classifySwipe, mainTabOrder } from "./swipeIntent";

const base = { startX: 200, translationY: 4, velocityX: 0, screenWidth: 390 };

test("a long sideways swipe in the middle changes the section", () => {
  assert.equal(classifySwipe({ ...base, translationX: -120 }), "content-left");
  assert.equal(classifySwipe({ ...base, translationX: 120 }), "content-right");
});

test("a short drag or a mostly vertical drag is not a swipe", () => {
  assert.equal(classifySwipe({ ...base, translationX: -20 }), null);
  assert.equal(classifySwipe({ ...base, translationX: -90, translationY: 80 }), null);
});

test("a flick counts over a shorter distance", () => {
  assert.equal(classifySwipe({ ...base, translationX: -40, velocityX: -900 }), "content-left");
  assert.equal(classifySwipe({ ...base, translationX: -40, velocityX: -100 }), null);
});

test("a swipe from the left edge moves to the previous page, only moving right", () => {
  assert.equal(classifySwipe({ ...base, startX: 6, translationX: 110 }), "edge-from-left");
  assert.equal(classifySwipe({ ...base, startX: 6, translationX: -110 }), null);
});

test("a swipe from the right edge moves to the next page, only moving left", () => {
  assert.equal(classifySwipe({ ...base, startX: 384, translationX: -110 }), "edge-from-right");
  assert.equal(classifySwipe({ ...base, startX: 384, translationX: 110 }), null);
});

test("the tab bar order follows the flags and Create sits between Home and Reviews", () => {
  assert.deepEqual(mainTabOrder({ socialFeedEnabled: false, reviewCreationEnabled: true }), [
    "Discover",
    "Create",
    "Review",
    "Profile",
  ]);
  assert.deepEqual(mainTabOrder({ socialFeedEnabled: true, reviewCreationEnabled: false }), [
    "Discover",
    "Home",
    "Profile",
  ]);
});

test("the neighbour tab is the next or previous in the bar, and none past the ends", () => {
  const order = mainTabOrder({ socialFeedEnabled: false, reviewCreationEnabled: true });
  assert.equal(adjacentTabKey(order, "Discover", "next"), "Create");
  assert.equal(adjacentTabKey(order, "Review", "previous"), "Create");
  assert.equal(adjacentTabKey(order, "Review", "next"), "Profile");
  assert.equal(adjacentTabKey(order, "Discover", "previous"), undefined);
  assert.equal(adjacentTabKey(order, "Profile", "next"), undefined);
});
