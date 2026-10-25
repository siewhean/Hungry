// Map clusters show their count at every zoom. Run with `npm run test:render`.
import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach } from "node:test";

import { MarkerVisual } from "@/components/map/MapSurface";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

test("a cluster draws as a bubble with its count when zoomed out, where labels are hidden", async () => {
  const view = await render(
    createElement(MarkerVisual, {
      label: "120 venues",
      accent: "#1A2E44",
      selected: false,
      zoomLevel: 12,
      clusterCount: 120,
    }),
  );
  assert.ok(view.findByTestId("map-cluster-bubble"));
  assert.ok(view.findByText("120"));
});

test("a single stall pin at the same zoom has no count bubble", async () => {
  const view = await render(
    createElement(MarkerVisual, {
      label: "Tian Tian",
      accent: "#E8531E",
      selected: false,
      zoomLevel: 12,
    }),
  );
  assert.equal(view.findByTestId("map-cluster-bubble"), null);
  assert.equal(view.findByText("Tian Tian"), null, "labels stay hidden when zoomed out");
});
