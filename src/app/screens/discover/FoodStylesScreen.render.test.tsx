// The Popular dishes page: every dish as a picture circle, with pinning. Run with
// `HUNGRY_DATA_SOURCE=mock node scripts/test-render.mjs src/app/screens/discover/FoodStylesScreen.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { createElement } from "react";

import { POPULAR_FOOD_STYLES } from "@/features/discover/popularFoodStyles";
import { useFeedFeedbackStore } from "@/store/useFeedFeedbackStore";
import { cleanup, render } from "@/test/render";

import { FoodStylesScreen } from "./FoodStylesScreen";

beforeEach(() => useFeedFeedbackStore.getState()._reset());
afterEach(async () => {
  await cleanup();
  useFeedFeedbackStore.getState()._reset();
});

const dishLabels = () =>
  Array.from(document.body.querySelectorAll("[aria-label^='Search for']")).map(
    (element) => element.getAttribute("aria-label") ?? "",
  );

test("the page has no sub-heading and no longer lists Chilli Chicken Rice", async () => {
  const view = await render(createElement(FoodStylesScreen));
  const text = view.text();
  assert.match(text, /Popular dishes/);
  assert.doesNotMatch(text, /Pick a dish/);
  assert.equal(
    POPULAR_FOOD_STYLES.some((style) => style.id === "spice-chicken-rice"),
    false,
  );
  assert.equal(
    dishLabels().some((label) => /Chilli Chicken Rice/.test(label)),
    false,
  );
});

test("Edit favourites turns taps into pins, shows the star, and puts pinned dishes first", async () => {
  const view = await render(createElement(FoodStylesScreen));
  assert.equal(document.body.querySelectorAll("[data-testid='favourite-star']").length, 0);
  const lastLabel = dishLabels().at(-1) ?? "";

  assert.equal(document.body.querySelectorAll("[data-testid='favourite-star-empty']").length, 0);
  await view.press(view.findByLabel("Edit favourites"));
  assert.doesNotMatch(view.text(), /Edit favourites/, "the button is an icon, with no text");
  assert.doesNotMatch(view.text(), /Tap the dishes you want first/);
  assert.equal(
    document.body.querySelectorAll("[data-testid='favourite-star-empty']").length,
    dishLabels().length,
    "every dish shows a grey star while editing",
  );
  await view.press(view.findByLabel(lastLabel));

  assert.equal(useFeedFeedbackStore.getState().favouriteFoodStyleIds.length, 1);
  assert.equal(document.body.querySelectorAll("[data-testid='favourite-star']").length, 1);
  assert.equal(
    document.body.querySelectorAll("[data-testid='favourite-star-empty']").length,
    dishLabels().length - 1,
    "the pinned dish has the gold star, the rest stay grey",
  );
  assert.equal(dishLabels()[0], `${lastLabel}, favourite`, "the pinned dish moved to the front");
  assert.equal(view.navigation.calls.length, 0, "editing does not search");

  await view.press(view.findByLabel(`${lastLabel}, favourite`));
  assert.equal(useFeedFeedbackStore.getState().favouriteFoodStyleIds.length, 0);

  await view.press(view.findByLabel("Done editing favourites"));
  assert.equal(document.body.querySelectorAll("[data-testid='favourite-star-empty']").length, 0);
});

test("outside edit mode a tap searches for the dish and pins nothing", async () => {
  const view = await render(createElement(FoodStylesScreen));
  await view.press(view.findByLabel(dishLabels()[0]));
  assert.equal(useFeedFeedbackStore.getState().favouriteFoodStyleIds.length, 0);
  assert.equal(view.navigation.calls.at(-1)?.method, "navigate");
  assert.equal(view.navigation.calls.at(-1)?.args[0], "SearchResults");
});
