import assert from "node:assert/strict";
import test from "node:test";

import {
  getDishSection,
  groupDishesBySection,
  isFeatured,
  isStallsPick,
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

test("isStallsPick is a featured dish that can still be ordered", () => {
  assert.equal(isStallsPick(["featured"]), true);
  assert.equal(isStallsPick(["featured", "sold_out"]), false);
  assert.equal(isStallsPick(["sold_out"]), false);
});

test("groupDishesBySection sorts sections A to Z, keeps dish order and puts the rest under Other", () => {
  const dish = (id: string, ...flags: string[]) => ({ id, availabilityFlags: flags });
  const groups = groupDishesBySection([
    dish("a", "section:Mains"),
    dish("b"),
    dish("c", "section:drinks"),
    dish("d", "section:Mains", "sold_out"),
  ]);
  assert.deepEqual(
    groups.map((group) => [group.title, group.data.map((d) => d.id)]),
    [
      ["drinks", ["c"]],
      ["Mains", ["a", "d"]],
      ["Other", ["b"]],
    ],
  );
});

test("groupDishesBySection gives a menu without sections one untitled group, and none when empty", () => {
  assert.deepEqual(groupDishesBySection([]), []);
  const groups = groupDishesBySection([{ availabilityFlags: ["featured"] }, {}]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, null);
  assert.equal(groups[0].data.length, 2);
});
