// The chip's selected states. Run with
// `HUNGRY_DATA_SOURCE=mock node scripts/test-render.mjs src/components/ui/Chip.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { cleanup, render } from "@/test/render";

import { Chip } from "./Chip";

afterEach(cleanup);

function chipButton(view: Awaited<ReturnType<typeof render>>, label: string) {
  const button = view.findByLabel(label);
  assert.ok(button, `the ${label} chip renders`);
  return button;
}

test("a chosen solid chip is filled orange so it stands out from content behind it", async () => {
  const solid = await render(<Chip label="Spicy" selected solid onPress={() => undefined} />);
  const tinted = await render(<Chip label="Soup" selected onPress={() => undefined} />);
  const solidBg = getComputedStyle(chipButton(solid, "Spicy")).backgroundColor;
  const tintedBg = getComputedStyle(chipButton(tinted, "Soup")).backgroundColor;
  assert.notEqual(solidBg, tintedBg, "solid selected differs from the tinted selected state");
  assert.doesNotMatch(solidBg, /rgba\(.*,\s*0?\.\d+\)$/, "the solid fill is not see-through");
});

test("a chosen solid chip keeps its label readable: white text on the orange fill", async () => {
  const view = await render(<Chip label="Spicy" selected solid onPress={() => undefined} />);
  const label = view.findByText("Spicy");
  assert.ok(label, "the label renders");
  assert.equal(getComputedStyle(label).color, "rgb(255, 255, 255)");
});
