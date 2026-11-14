// MoreLikeThisRail: hidden when empty, labels each tile, and opens the tile pressed.
// Run with `npm run test:render`.
import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach } from "node:test";

import { MoreLikeThisRail } from "@/components/recommendations/MoreLikeThisRail";
import { cleanup, render } from "@/test/render";
import type { DishDetail } from "@/types/domain";

afterEach(cleanup);

const dish = (id: string, venueId: string, name: string, distanceMeters?: number) =>
  ({ id, venueId, name, price: 5, distanceMeters, tasteTags: [] }) as unknown as DishDetail;

const ITEMS = [dish("a", "v2", "Mee Siam", 400), dish("b", "v3", "Nasi Lemak")];
const VENUES: Record<string, string> = { v2: "Ah Hock", v3: "Selera Rasa" };

test("an empty rail draws nothing", async () => {
  const view = await render(
    createElement(MoreLikeThisRail, {
      title: "More like this",
      items: [],
      mode: "dish",
      venueNameOf: () => undefined,
      onOpen: () => undefined,
      testID: "rail",
    }),
  );
  assert.equal(view.findByText("More like this"), null);
});

test("dish mode leads with the dish and opens the tile pressed, with its position", async () => {
  const opened: [string, number][] = [];
  const view = await render(
    createElement(MoreLikeThisRail, {
      title: "More like this",
      subtitle: "Same character, different dish",
      items: ITEMS,
      mode: "dish",
      venueNameOf: (d: DishDetail) => VENUES[d.venueId],
      onOpen: (d: DishDetail, position: number) => opened.push([d.id, position]),
    }),
  );
  assert.ok(view.findByText("More like this"));
  assert.ok(view.findByText("Same character, different dish"));
  await view.press(view.findByLabel(/^Open Nasi Lemak, Selera Rasa/));
  assert.deepEqual(opened, [["b", 1]]);
});

test("stall mode leads with the stall and suggests its dish", async () => {
  const view = await render(
    createElement(MoreLikeThisRail, {
      title: "Similar stalls nearby",
      items: ITEMS,
      mode: "stall",
      venueNameOf: (d: DishDetail) => VENUES[d.venueId],
      onOpen: () => undefined,
    }),
  );
  assert.ok(view.findByText("Ah Hock"));
  assert.ok(view.findByText("Try the Mee Siam"));
});
