// Each Home chip carries a picture that fits its label (no generic tag on Noodles or Western).
// Run with `node scripts/test-render.mjs src/components/discover/home/DiscoverChipIcon.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import {
  DISCOVER_CHIP_SYMBOLS,
  DiscoverChipIcon,
} from "@/components/discover/home/DiscoverChipIcon";
import { INTENT_CHIPS } from "@/features/discover/useDiscoverFilters";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

test("every Home chip except Halal has its own picture", () => {
  const ids = ["dietary", ...INTENT_CHIPS.map((chip) => chip.id)].filter((id) => id !== "halal");
  for (const id of ids) {
    assert.ok(DISCOVER_CHIP_SYMBOLS[id], `the ${id} chip has no picture`);
  }
});

test("food chips show a food picture, not the generic tag", () => {
  assert.equal(DISCOVER_CHIP_SYMBOLS.noodles.ios, "fork.knife.circle");
  assert.equal(DISCOVER_CHIP_SYMBOLS.western.ios, "fork.knife");
  assert.equal(DISCOVER_CHIP_SYMBOLS.soup.ios, "cup.and.heat.waves");
  assert.equal(DISCOVER_CHIP_SYMBOLS.drinks.ios, "cup.and.saucer");
  assert.equal(DISCOVER_CHIP_SYMBOLS.dessert.ios, "birthday.cake");
  assert.equal(DISCOVER_CHIP_SYMBOLS.breakfast.ios, "sunrise");
  assert.equal(DISCOVER_CHIP_SYMBOLS.late.ios, "moon");
});

test("the icon draws for a known chip, Halal and a chip it has never seen", async () => {
  for (const chipId of ["noodles", "halal", "something-new"]) {
    const view = await render(<DiscoverChipIcon chipId={chipId} color="#000" />);
    assert.ok(view.container.firstChild, `${chipId} drew nothing`);
    await cleanup();
  }
});
