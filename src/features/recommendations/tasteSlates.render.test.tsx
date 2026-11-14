// The taste slate hooks: they stay empty without a palate or a point, and load once given both.
// Run with `npm run test:render`.
import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach } from "node:test";

import {
  useTasteSearch,
  useTrustedPalate,
  useWorthTheTrip,
} from "@/features/recommendations/tasteSlates";
import { cleanup, render, settle } from "@/test/render";
import type { TasteVector } from "@/types/domain";

afterEach(cleanup);

const PALATE: TasteVector = { sweet: 4, spicy: 8, sour: 5, salty: 6, rich: 7, aromatic: 6 };
const POINT = { latitude: 1.3, longitude: 103.8 };

function Probe({ withPalate, query }: { withPalate: boolean; query: string }) {
  const trusted = useTrustedPalate();
  const palate = withPalate ? PALATE : undefined;
  const trip = useWorthTheTrip(palate, POINT, []);
  const search = useTasteSearch(palate, query, withPalate ? POINT : undefined);
  return createElement(
    "div",
    { "data-testid": "probe" },
    `trusted:${trusted ? "yes" : "no"} trip:${trip.length} search:${search.length}`,
  );
}

test("without a palate nothing is read and both rails stay empty", async () => {
  const view = await render(createElement(Probe, { withPalate: false, query: "laksa" }));
  await settle();
  assert.ok(view.findByText(/trip:0 search:0/));
});

test("with a palate the hooks read and settle on a list (possibly empty for the mock)", async () => {
  const view = await render(createElement(Probe, { withPalate: true, query: "noodles" }));
  await settle();
  assert.ok(view.findByText(/trusted:(yes|no) trip:\d+ search:\d+/));
  // A one-letter query is not searched.
  await view.rerender(createElement(Probe, { withPalate: true, query: "n" }));
  await settle();
  assert.ok(view.findByText(/search:0/));
});
