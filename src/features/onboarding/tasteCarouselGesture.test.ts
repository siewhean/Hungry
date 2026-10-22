import assert from "node:assert/strict";
import test from "node:test";
import { createTasteCarouselGesture } from "./tasteCarouselGesture";

test("restoring a saved sweet answer cannot commit the carousel's transient Light offset", () => {
  const gesture = createTasteCarouselGesture();
  let savedSweet = 8;
  // Reload starts on spicy; navigating Back scrolls the saved sweet selection into position.
  gesture.cancel();
  if (gesture.acceptEnd("sweet", true)) savedSweet = 2;
  assert.equal(savedSweet, 8);
});

test("actual drag end and final momentum can select an answer for the current question", () => {
  const gesture = createTasteCarouselGesture();
  gesture.begin("sweet");
  assert.equal(gesture.acceptEnd("sweet", false), true);
  assert.equal(gesture.acceptEnd("sweet", true), true);
  assert.equal(gesture.acceptEnd("sweet", true), false);
});

test("a late old-question momentum event cannot answer the new question", () => {
  const gesture = createTasteCarouselGesture();
  gesture.begin("sweet");
  assert.equal(gesture.acceptEnd("spicy", true), false);
  assert.equal(gesture.acceptEnd("sweet", true), true);
  gesture.begin("spicy");
  gesture.cancel(); // Step change, resize, explicit card press, or restoration.
  assert.equal(gesture.acceptEnd("spicy", true), false);
});
