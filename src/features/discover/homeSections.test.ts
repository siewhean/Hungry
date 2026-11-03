import assert from "node:assert/strict";
import test from "node:test";

import type { TasteVector } from "@/types/domain";

import { buildHomeSections, palateFit, type HomeSectionCard } from "./homeSections";

const NEUTRAL: TasteVector = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };
const vec = (overrides: Partial<TasteVector>): TasteVector => ({ ...NEUTRAL, ...overrides });

function card(
  id: string,
  dishName: string,
  tasteVector?: TasteVector,
  rating = 4,
): HomeSectionCard {
  return { venue: { id, name: `Stall ${id}` }, topDish: { name: dishName, rating, tasteVector } };
}

// Nine stalls of nine different foods, tagged with a taste.
const MIXED: HomeSectionCard[] = [
  card("1", "Prawn Noodles", vec({ spicy: 8, rich: 7 })),
  card("2", "Chicken Rice", vec({ rich: 7 })),
  card("3", "Nasi Lemak", vec({ spicy: 7, rich: 8 })),
  card("4", "Chendol", vec({ sweet: 9 })),
  card("5", "Bak Kut Teh Soup", vec({ aromatic: 8 })),
  card("6", "Mee Siam Noodles", vec({ spicy: 8, sour: 7 })),
  card("7", "Duck Rice", vec({ rich: 9 })),
  card("8", "Kaya Toast", vec({ sweet: 8, rich: 6 })),
  card("9", "Laksa Noodles", vec({ spicy: 9, rich: 7 })),
  card("10", "Roti Prata", vec({ rich: 8 })),
];
// Enough stalls that the recommended section leaves some for the others.
const BIG: HomeSectionCard[] = [0, 1, 2].flatMap((copy) =>
  MIXED.map((c) => ({ ...c, venue: { id: `${c.venue.id}-${copy}`, name: c.venue.name } })),
);
const SPICY_LOVER = vec({ spicy: 9, rich: 7, sweet: 3 });

test("the recommended section is made of different foods and claims its stalls", () => {
  const sections = buildHomeSections(MIXED, {
    hour: 19,
    palate: SPICY_LOVER,
    palateTrusted: true,
  });
  const recommended = sections[0];
  assert.equal(recommended.id, "recommended");
  assert.equal(recommended.title, "Recommended for you");
  assert.ok(recommended.cards.length >= 3);
  // No food kind shows twice before every kind has shown once.
  const kinds = recommended.cards.slice(0, 3).map((c) => c.topDish?.name.split(" ")[0]);
  assert.equal(new Set(kinds).size, 3);
  // A stall is in one section only.
  const ids = sections.flatMap((section) => section.cards.map((c) => c.venue.id));
  assert.equal(new Set(ids).size, ids.length);
});

test("without a trusted palate the section is called Popular near you", () => {
  const sections = buildHomeSections(MIXED, { hour: 19 });
  assert.equal(sections[0]?.title, "Popular near you");
});

test("taste sections follow the palate and mix food types", () => {
  const sections = buildHomeSections(BIG, {
    hour: 19,
    palate: SPICY_LOVER,
    palateTrusted: true,
    maxSections: 10,
  });
  const taste = sections.filter((section) => section.kind === "taste");
  assert.ok(taste.length >= 1);
  assert.equal(taste[0].id, "taste-spicy", "the strongest taste leads");
  assert.ok(taste[0].cards.every((c) => (c.topDish?.tasteVector?.spicy ?? 0) >= 6.5));
  assert.ok(new Set(taste[0].cards.map((c) => c.topDish?.name.split(" ")[0])).size >= 2);
  // Never more than two of one food kind in a taste section.
  const noodles = taste[0].cards.filter((c) => /noodle/i.test(c.topDish?.name ?? ""));
  assert.ok(noodles.length <= 2);
});

test("someone who cannot take spice never gets hot dishes or a spicy section", () => {
  const sections = buildHomeSections(BIG, {
    hour: 19,
    palate: vec({ spicy: 1, rich: 8 }),
    palateTrusted: true,
    avoidSpicy: true,
    maxSections: 10,
  });
  assert.equal(
    sections.some((section) => section.id === "taste-spicy"),
    false,
  );
  for (const section of sections.filter((s) => s.kind === "recommended" || s.kind === "taste")) {
    assert.ok(section.cards.every((c) => (c.topDish?.tasteVector?.spicy ?? 0) < 6));
  }
});

test("dishes with no taste data are not given a taste section", () => {
  const untagged = Array.from({ length: 8 }, (_, i) => card(`u${i}`, `Dish ${i}`, vec({})));
  const sections = buildHomeSections(untagged, {
    hour: 12,
    palate: SPICY_LOVER,
    palateTrusted: true,
  });
  assert.equal(sections.filter((s) => s.kind === "taste").length, 0);
});

test("stalls already shown above are left out, and thin sections are skipped", () => {
  const excluded = new Set(MIXED.map((c) => c.venue.id));
  assert.deepEqual(buildHomeSections(MIXED, { hour: 19, excludeVenueIds: excluded }), []);
  assert.deepEqual(buildHomeSections(MIXED.slice(0, 2), { hour: 19 }), []);
});

test("pinned dishes and the foods the diner has had lead the food sections", () => {
  const noodleStalls = ["a", "b", "c", "d"].map((id) => card(`n${id}`, "Prawn Noodles"));
  const riceStalls = ["a", "b", "c", "d"].map((id) => card(`r${id}`, "Chicken Rice"));
  const sections = buildHomeSections([...noodleStalls, ...riceStalls], {
    hour: 12,
    familiarNames: ["chicken rice"],
    favourites: [{ id: "laksa", label: "Laksa", query: "Laksa" }],
  });
  const food = sections.filter((section) => section.kind === "food");
  assert.equal(food[0]?.id, "rice", "what the diner has had comes first");
});

test("a section chevron has something to search for, and sections are capped", () => {
  const sections = buildHomeSections(MIXED, {
    hour: 19,
    palate: SPICY_LOVER,
    palateTrusted: true,
    maxSections: 2,
  });
  assert.ok(sections.length <= 2);
  for (const section of sections.filter((s) => s.kind === "taste")) assert.ok(section.query);
});

test("palateFit is 1 for the same taste and falls as they differ", () => {
  assert.equal(palateFit(SPICY_LOVER, SPICY_LOVER), 1);
  assert.ok(palateFit(SPICY_LOVER, vec({ spicy: 0, rich: 0, sweet: 10 })) < 0.7);
});
