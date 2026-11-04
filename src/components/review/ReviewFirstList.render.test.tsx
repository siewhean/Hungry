// The Reviews tab before any review exists: the places the diner has been, one tap from a review.
// Run with `npm run test:render`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createElement } from "react";

import { ReviewFirstList } from "@/components/review/ReviewFirstList";
import { cleanup, render } from "@/test/render";
import type { VenueSummary } from "@/types/domain";

afterEach(cleanup);

const stall = (id: string, name: string, buildingName?: string) =>
  ({
    id,
    name,
    buildingId: "b1",
    unitNumber: "",
    floor: "",
    isOpen: true,
    topDishId: "",
    operatingHours: "",
    deliveryLinks: [],
    buildingName,
  }) as VenueSummary;

test("it lists visited stalls and opens the review for the one tapped", async () => {
  const reviewed: string[] = [];
  const view = await render(
    createElement(ReviewFirstList, {
      stalls: [stall("s1", "Ah Kow Laksa", "Old Airport Road"), stall("s2", "Bee Chicken Rice")],
      onReview: (picked) => reviewed.push(picked.id),
    }),
  );
  assert.match(view.text(), /Places you have been/);
  assert.match(view.text(), /Old Airport Road/);
  await view.press(view.findByLabel("Review Bee Chicken Rice"));
  assert.deepEqual(reviewed, ["s2"]);
});

test("without visits it renders nothing", async () => {
  const view = await render(createElement(ReviewFirstList, { stalls: [], onReview: () => {} }));
  assert.doesNotMatch(view.text(), /Places you have been/);
});
