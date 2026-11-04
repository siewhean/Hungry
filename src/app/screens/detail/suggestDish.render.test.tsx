// The "Suggest a dish" page: name the dish, send it to the team to check.
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { SuggestDishScreen } from "@/app/screens/detail/SuggestDishScreen";
import { getHungryService } from "@/lib/services/serviceProvider";
import { cleanup, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

const restores: (() => void)[] = [];
beforeEach(async () => {
  await enterScenario("user");
});
afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()?.();
});

function captureCorrections() {
  const sent: { venueId: string; kind: string; note?: string; dishId?: string }[] = [];
  const supply = getHungryService().supply;
  const original = supply.submitCatalogCorrection;
  supply.submitCatalogCorrection = (async (input: {
    venueId: string;
    kind: string;
    note?: string;
    dishId?: string;
  }) => {
    sent.push(input);
  }) as never;
  restores.push(() => {
    supply.submitCatalogCorrection = original;
  });
  return sent;
}

test("a dish name, price and detail go to the team as a New dish note", async () => {
  const sent = captureCorrections();
  const view = await renderScreen(SuggestDishScreen as never, {
    name: "SuggestDish",
    params: { venueId: "v1", subjectName: "Nam Sing" },
  });
  assert.match(view.text(), /What does Nam Sing serve that's missing\?/);
  await view.type(view.findByLabel("Dish name"), "Chicken rice");
  await view.type(view.findByLabel("Price (optional)"), "4.5");
  await view.press(view.findByText("Send dish"));
  await view.settle();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].venueId, "v1");
  assert.equal(sent[0].kind, "wrong_dish_info");
  assert.equal(sent[0].dishId, undefined, "a new dish has no dish id yet");
  assert.equal(sent[0].note, "New dish: Chicken rice · S$4.50");
});

test("nothing is sent until the dish has a name", async () => {
  const sent = captureCorrections();
  const view = await renderScreen(SuggestDishScreen as never, {
    name: "SuggestDish",
    params: { venueId: "v1" },
  });
  await view.press(view.findByText("Send dish"));
  await view.settle();
  assert.equal(sent.length, 0);
});

test("a price that is not a number is explained and not sent", async () => {
  const sent = captureCorrections();
  const view = await renderScreen(SuggestDishScreen as never, {
    name: "SuggestDish",
    params: { venueId: "v1" },
  });
  await view.type(view.findByLabel("Dish name"), "Laksa");
  await view.type(view.findByLabel("Price (optional)"), "cheap");
  assert.match(view.text(), /Enter the price as a number/);
  await view.press(view.findByText("Send dish"));
  await view.settle();
  assert.equal(sent.length, 0);
});
