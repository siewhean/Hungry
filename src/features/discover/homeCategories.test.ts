import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCategorySections,
  classifyHomeText,
  matchesHomeCategory,
  HOME_CATEGORIES,
} from "./homeCategories";

const card = (id: string, name: string, dish?: string) => ({
  venue: { id, name },
  topDish: dish ? { name: dish } : undefined,
});

test("a stall is placed by the first kind its name or dish names", () => {
  assert.equal(classifyHomeText("Ah Hock Prawn Noodles"), "noodles");
  assert.equal(classifyHomeText("Tian Tian Hainanese Chicken Rice"), "rice");
  assert.equal(classifyHomeText("Ramen Champion"), "japkor", "Japanese wins over noodles");
  assert.equal(classifyHomeText("Fish Soup Stall"), "soup", "soup wins over seafood");
  assert.equal(classifyHomeText("Mr Bean"), undefined);
});

test("kinds match whole words only", () => {
  assert.equal(matchesHomeCategory("dessert", "Price Mart"), false, "ice is not in Price");
  assert.equal(matchesHomeCategory("rice", "Rice Bowl"), true);
  assert.equal(matchesHomeCategory("drinks", "Kopi Corner"), true);
});

test("every kind has a title, a chip label, a search word and keywords", () => {
  for (const category of HOME_CATEGORIES) {
    assert.ok(category.title && category.chipLabel && category.query && category.keywords.length);
  }
  assert.equal(
    new Set(HOME_CATEGORIES.map((category) => category.id)).size,
    HOME_CATEGORIES.length,
  );
});

const pool = [
  card("n1", "Prawn Noodles"),
  card("n2", "Wanton Mee"),
  card("n3", "Lor Mee House"),
  card("r1", "Chicken Rice Stall"),
  card("r2", "Duck Rice"),
  card("r3", "Economic Rice"),
  card("d1", "Chendol Corner"),
  card("d2", "Ice Kacang"),
  card("x1", "Mr Bean"),
];

test("sections hold different foods and never repeat a stall", () => {
  const sections = buildCategorySections(pool, { hour: 12 });
  assert.deepEqual(
    sections.map((section) => section.id),
    ["rice", "noodles"],
  );
  const ids = sections.flatMap((section) => section.cards.map((entry) => entry.venue.id));
  assert.equal(new Set(ids).size, ids.length);
});

test("a kind with fewer than three stalls is skipped, and the time of day leads", () => {
  const afternoon = buildCategorySections([...pool, card("d3", "Cendol Pulut Hitam")], {
    hour: 15,
  });
  assert.equal(afternoon[0]?.id, "dessert");
  assert.ok(!afternoon.some((section) => section.id === "drinks"));
});

test("pinned dishes get their own section first, and kinds the diner has had lead next", () => {
  const sections = buildCategorySections(pool, {
    hour: 12,
    favourites: [{ id: "duck-rice", label: "Rice", query: "Rice" }],
    familiarNames: ["Prawn Noodles"],
  });
  assert.equal(sections[0]?.id, "favourite-duck-rice");
  assert.equal(sections[0]?.title, "Rice near you");
  assert.equal(sections[1]?.id, "noodles");
});

test("stalls shown above are left out, and the order inside a section follows compare", () => {
  const sections = buildCategorySections(pool, {
    hour: 12,
    excludeVenueIds: new Set(["n1"]),
    compare: (a, b) => b.venue.name.localeCompare(a.venue.name),
    minItems: 2,
  });
  const noodles = sections.find((section) => section.id === "noodles");
  assert.deepEqual(
    noodles?.cards.map((entry) => entry.venue.id),
    ["n2", "n3"],
  );
  assert.ok(!noodles?.cards.some((entry) => entry.venue.id === "n1"));
});

test("sections stop at the most asked for", () => {
  const many = HOME_CATEGORIES.flatMap((category) =>
    [1, 2, 3].map((n) => card(`${category.id}-${n}`, `${category.keywords[0]} place ${n}`)),
  );
  assert.ok(buildCategorySections(many, { hour: 12, maxSections: 3 }).length <= 3);
});
