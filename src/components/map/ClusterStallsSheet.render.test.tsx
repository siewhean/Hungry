// The cluster list: it names every stall behind the pin, a tap picks one, and a long cluster
// says some are not listed. Run with `npm run test:render`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createElement } from "react";

import { ClusterStallsSheet, type ClusterStallRow } from "@/components/map";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

const ROWS: ClusterStallRow[] = [
  {
    id: "a",
    name: "Ah Kow Laksa",
    detail: "Open · Closes 9pm · 120 m",
    location: "JW50 Hawker Centre · #01-23",
    accessibilityLabel: "Open Ah Kow Laksa",
  },
  { id: "b", name: "Bee Chicken Rice", accessibilityLabel: "Open Bee Chicken Rice" },
];

test("it lists the stalls behind the pin and opens the one that is tapped", async () => {
  const picked: string[] = [];
  const view = await render(
    createElement(ClusterStallsSheet, {
      visible: true,
      totalCount: 2,
      stalls: ROWS,
      loading: false,
      onSelect: (id: string) => picked.push(id),
      onClose: () => undefined,
    }),
  );
  assert.match(view.text(), /2 stalls here/);
  assert.match(view.text(), /Ah Kow Laksa/);
  assert.match(view.text(), /JW50 Hawker Centre/);
  await view.press(view.findByText("Bee Chicken Rice"));
  assert.deepEqual(picked, ["b"]);
});

test("a long cluster says how many are not listed, and a loading one shows no rows", async () => {
  const view = await render(
    createElement(ClusterStallsSheet, {
      visible: true,
      totalCount: 40,
      stalls: ROWS,
      loading: false,
      onSelect: () => undefined,
      onClose: () => undefined,
    }),
  );
  assert.match(view.text(), /Showing the nearest 2\. Zoom in to see the other 38\./);
  await cleanup();
  const loading = await render(
    createElement(ClusterStallsSheet, {
      visible: true,
      totalCount: 3,
      stalls: [],
      loading: true,
      onSelect: () => undefined,
      onClose: () => undefined,
    }),
  );
  assert.doesNotMatch(loading.text(), /Ah Kow/);
});
