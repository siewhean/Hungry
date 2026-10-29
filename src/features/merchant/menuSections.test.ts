import assert from "node:assert/strict";
import test from "node:test";

import {
  getDishSection,
  isFeatured,
  isSoldOut,
  listMenuSections,
  withDishSection,
} from "@/features/merchant/menuSections";

test("menu section round-trips through availability flags", () => {
  const flags = withDishSection(["sold_out", "featured"], "  Noodle   Soups ");
  assert.deepEqual(flags, ["sold_out", "featured", "section:Noodle Soups"]);
  assert.equal(getDishSection(flags), "Noodle Soups");
  assert.equal(isSoldOut(flags), true);
});

test("clearing or replacing a section keeps other flags", () => {
  const flags = ["featured", "section:Rice"];
  assert.deepEqual(withDishSection(flags, ""), ["featured"]);
  assert.deepEqual(withDishSection(flags, "Drinks"), ["featured", "section:Drinks"]);
  assert.equal(getDishSection(["featured"]), undefined);
});

test("listMenuSections de-duplicates case-insensitively in first-seen order", () => {
  assert.deepEqual(
    listMenuSections([["section:Rice"], ["section:drinks"], ["section:rice"], undefined]),
    ["Rice", "drinks"],
  );
});

test("isFeatured reads the featured flag however it was typed", () => {
  assert.equal(isFeatured(["Featured"]), true);
  assert.equal(isFeatured(["sold_out"]), false);
  assert.equal(isFeatured(undefined), false);
});
