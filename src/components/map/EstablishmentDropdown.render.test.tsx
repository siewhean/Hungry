// The map's place-type dropdown: tick several kinds, see the chip label follow, clear them.
// Run with `npm run test:render`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createElement } from "react";

import { EstablishmentDropdown, establishmentChipLabel } from "@/components/map";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

test("the chip label names one type, counts several and prompts when none", () => {
  assert.equal(establishmentChipLabel([]), "Place type");
  assert.equal(establishmentChipLabel(["hawker_centre"]), "Hawker centre");
  assert.equal(establishmentChipLabel(["hawker_centre", "cafe"]), "2 place types");
});

test("ticking a type adds it and ticking it again removes it", async () => {
  const calls: string[][] = [];
  const view = await render(
    createElement(EstablishmentDropdown, {
      selected: ["cafe"],
      onChange: (types: string[]) => calls.push(types),
    }),
  );
  await view.press(view.findByText("Kopitiam"));
  await view.press(view.findByText("Café"));
  assert.deepEqual(calls, [["cafe", "kopitiam"], []]);
});

test("Clear empties the choice", async () => {
  const calls: string[][] = [];
  const view = await render(
    createElement(EstablishmentDropdown, {
      selected: ["mall", "cafe"],
      onChange: (types: string[]) => calls.push(types),
    }),
  );
  await view.press(view.findByText("Clear"));
  assert.deepEqual(calls, [[]]);
});
