// A Home row opens on its first page and keeps the rest for the scroll. Run with `npm run test:render`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createElement } from "react";
import { Text } from "react-native";

import { PagedRailScrollView } from "@/components/discover/home/PagedRailScrollView";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

const items = Array.from({ length: 20 }, (_, index) => `Dish ${index + 1}`);
const row = (initialCount?: number) =>
  createElement(PagedRailScrollView<string>, {
    items,
    initialCount,
    renderItem: (name: string) => createElement(Text, { key: name }, name),
  });

test("a row opens on its first page and holds the rest back", async () => {
  const view = await render(row(4));
  assert.match(view.text(), /Dish 1/);
  assert.match(view.text(), /Dish 4/);
  assert.doesNotMatch(view.text(), /Dish 5\b/);
});

test("a row with no first page given shows a standard page, not everything at once", async () => {
  const view = await render(row());
  assert.match(view.text(), /Dish 8/);
  assert.doesNotMatch(view.text(), /Dish 9\b/);
});

test("a row shorter than its first page shows all of it", async () => {
  const view = await render(
    createElement(PagedRailScrollView<string>, {
      items: ["Only one"],
      initialCount: 6,
      renderItem: (name: string) => createElement(Text, { key: name }, name),
    }),
  );
  assert.match(view.text(), /Only one/);
});
