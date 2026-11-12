import assert from "node:assert/strict";
import test from "node:test";

import type { TasteVector } from "@/types/domain";

import { HOME_CATEGORIES } from "./homeCategories";
import {
  buildHomeSections,
  hourSectionTitle,
  palateFit,
  type HomeSectionCard,
} from "./homeSections";

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
// Enough stalls that every section finds its own.
const HUGE: HomeSectionCard[] = [0, 1, 2, 3].flatMap((copy) =>
  BIG.map((c) => ({ ...c, venue: { id: `${c.venue.id}-h${copy}`, name: c.venue.name } })),
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
  assert.equal(recommended.title, "Just for you");
  assert.ok(recommended.cards.length >= 3);
  // No food kind shows twice before every kind has shown once.
  const kinds = recommended.cards.slice(0, 3).map((c) => c.topDish?.name.split(" ")[0]);
  assert.equal(new Set(kinds).size, 3);
  // A stall is in one section only.
  const ids = sections.flatMap((section) => section.cards.map((c) => c.venue.id));
  assert.equal(new Set(ids).size, ids.length);
});

test("without a trusted palate the lead section is Popular in the area", () => {
  const sections = buildHomeSections(MIXED, { hour: 19 });
  assert.equal(sections[0]?.title, "Popular in the area");
});

test("taste sections follow the palate and mix food types", () => {
  const sections = buildHomeSections(HUGE, {
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

test("pinned dishes become a reason, not a food heading", () => {
  const laksa = ["a", "b", "c", "d"].map((id) => card(`l${id}`, "Laksa"));
  const other = ["a", "b", "c", "d"].map((id) => card(`r${id}`, "Chicken Rice"));
  const filler = Array.from({ length: 24 }, (_, i) => card(`x${i}`, "Kaya Toast"));
  const sections = buildHomeSections([...filler, ...laksa, ...other], {
    hour: 12,
    favourites: [{ id: "laksa", label: "Laksa", query: "Laksa" }],
  });
  const pinned = sections.find((section) => section.kind === "favourite");
  assert.equal(pinned?.title, "Because you like Laksa");
  assert.equal(pinned?.query, "Laksa");
});

test("no section is named after a kind of food", () => {
  const sections = buildHomeSections(HUGE, {
    hour: 12,
    palate: SPICY_LOVER,
    palateTrusted: true,
    maxSections: 10,
    favourites: [{ id: "laksa", label: "Laksa", query: "Laksa" }],
  });
  assert.ok(sections.length >= 3);
  const foodTitles = new Set(HOME_CATEGORIES.map((category) => category.title));
  for (const section of sections.filter((s) => s.kind !== "favourite")) {
    assert.equal(foodTitles.has(section.title), false, section.title);
  }
  // A stall is in one section only.
  const ids = sections.flatMap((section) => section.cards.map((c) => c.venue.id));
  assert.equal(new Set(ids).size, ids.length);
});

test("the hour's section names the moment and Late night only shows at night", () => {
  assert.equal(hourSectionTitle(8), "Breakfast nearby");
  assert.equal(hourSectionTitle(12), "Lunch nearby");
  assert.equal(hourSectionTitle(15), "Afternoon treats");
  assert.equal(hourSectionTitle(19), "Dinner tonight");
  assert.equal(hourSectionTitle(23), "Late night");
  assert.equal(hourSectionTitle(2), "Late night");
  const titles = (hour: number) =>
    buildHomeSections(BIG, { hour, maxSections: 10 }).map((section) => section.title);
  assert.ok(titles(23).includes("Late night"));
  assert.equal(titles(13).includes("Late night"), false);
});

test("the hour's section holds only stalls that are open now", () => {
  const open = new Set(HUGE.slice(-40).map((c) => c.venue.id));
  const sections = buildHomeSections(HUGE, {
    hour: 23,
    maxSections: 10,
    isOpenNow: (c) => open.has(c.venue.id),
  });
  const night = sections.find((section) => section.id === "hour");
  assert.equal(night?.title, "Late night");
  assert.ok(night && night.cards.length >= 3);
  assert.ok(night.cards.every((c) => open.has(c.venue.id)));
  // Nothing open: no Late night section at all.
  const none = buildHomeSections(HUGE, { hour: 23, maxSections: 10, isOpenNow: () => false });
  assert.equal(
    none.some((section) => section.id === "hour"),
    false,
  );
});

test("Popular in the area ranks well-reviewed stalls and New and worth a try holds unproven ones", () => {
  const proven = Array.from({ length: 24 }, (_, i) => ({
    venue: { id: `p${i}`, name: `Proven ${i}` },
    topDish: { name: `Dish ${i}`, rating: 4.6, reviewCount: 40 },
  }));
  const fresh = Array.from({ length: 24 }, (_, i) => ({
    venue: { id: `f${i}`, name: `Fresh ${i}` },
    topDish: { name: `Plate ${i}`, rating: 0, reviewCount: 0 },
  }));
  const sections = buildHomeSections([...fresh, ...proven], {
    hour: 12,
    palate: SPICY_LOVER,
    palateTrusted: true,
    maxSections: 10,
  });
  const popular = sections.find((section) => section.id === "popular");
  assert.ok(popular?.cards.every((c) => c.venue.id.startsWith("p")));
  const fresher = sections.find((section) => section.id === "new");
  assert.equal(fresher?.title, "New and worth a try");
  assert.ok(fresher?.cards.every((c) => c.venue.id.startsWith("f")));
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

// Stalls with no menu in the app: only a name and the catalogue's cuisine tags.
function stall(id: string, name: string, cuisineTags: string[] = [], buildingId = "b-out") {
  return { venue: { id, name, cuisineTags, buildingId } } as HomeSectionCard;
}
// Enough copies that every section finds its own.
const NO_MENUS: HomeSectionCard[] = Array.from({ length: 10 }, (_, copy) => copy).flatMap(
  (copy) => [
    stall(`thai-${copy}`, `Baan Thai ${copy}`, ["thai"]),
    stall(`mala-${copy}`, `Mala Hotpot ${copy}`, ["chinese"]),
    stall(`curry-${copy}`, `Spice Route ${copy}`, ["indian"]),
    stall(`kimchi-${copy}`, `Seoul Kitchen ${copy}`, ["korean"]),
    stall(`cake-${copy}`, `Sweet Bakery ${copy}`, ["bakery"]),
    stall(`gelato-${copy}`, `Gelato Bar ${copy}`, ["dessert"]),
    stall(`salad-${copy}`, `Green Salad ${copy}`, ["salad"]),
    stall(`plain-${copy}`, `Unit 0${copy}`),
  ],
);

test("stalls without a menu are still recommended by their cuisine and name", () => {
  const sections = buildHomeSections(NO_MENUS, {
    hour: 12,
    palate: SPICY_LOVER,
    palateTrusted: true,
    maxSections: 10,
  });
  const lead = sections.find((section) => section.id === "recommended");
  assert.equal(lead?.title, "Just for you");
  // The spicy lover's first picks are the spicy kitchens, not the dessert or salad bars.
  const firstThree = lead?.cards.slice(0, 3).map((c) => c.venue.id.split("-")[0]) ?? [];
  for (const kind of firstThree)
    assert.ok(["thai", "mala", "curry", "kimchi"].includes(kind), kind);
  // A stall known only by a bare unit name is never a recommendation.
  const ids = sections.flatMap((section) => section.cards.map((c) => c.venue.id));
  assert.equal(
    ids.some((id) => id.startsWith("plain")),
    false,
  );
  // The palate's strongest taste gets its own section from the stalls' leans.
  const heat = sections.find((section) => section.id === "taste-spicy");
  assert.ok(heat && heat.cards.length >= 3);
});

test("a dish's own tagged taste wins over the stall's name", () => {
  // "Baan Thai" leans spicy, but its tagged top dish is sweet: it is not in the spicy section.
  const sweetAtThai: HomeSectionCard = {
    venue: { id: "thai-sweet", name: "Baan Thai", cuisineTags: ["thai"] },
    topDish: { name: "Mango Sticky Rice", tasteVector: vec({ sweet: 9, spicy: 1 }) },
  };
  const sections = buildHomeSections([sweetAtThai, ...NO_MENUS], {
    hour: 12,
    palate: SPICY_LOVER,
    palateTrusted: true,
    maxSections: 10,
  });
  const heat = sections.find((section) => section.id === "taste-spicy");
  assert.equal(
    heat?.cards.some((c) => c.venue.id === "thai-sweet"),
    false,
  );
});

test("inside a mall its own stalls lead and the hour's section says here", () => {
  const inMall = NO_MENUS.map((c, index) =>
    index % 3 === 0 ? { ...c, venue: { ...c.venue, buildingId: "b-mall" } } : c,
  );
  const sections = buildHomeSections(inMall, {
    hour: 12,
    palate: SPICY_LOVER,
    palateTrusted: true,
    preferBuildingId: "b-mall",
    maxSections: 10,
  });
  const lead = sections.find((section) => section.id === "recommended");
  assert.equal(lead?.cards[0]?.venue.buildingId, "b-mall");
  assert.equal(hourSectionTitle(12, true), "Lunch here");
  assert.equal(hourSectionTitle(19, true), "Dinner here");
  assert.equal(hourSectionTitle(23, true), "Late night");
});

test("Try something different holds kinds the diner has not had, unless they keep to favourites", () => {
  const options = {
    hour: 12,
    palate: SPICY_LOVER,
    palateTrusted: true,
    maxSections: 10,
    perSection: 4,
    familiarNames: ["chicken rice"],
  };
  const different = buildHomeSections(HUGE, options).find((s) => s.id === "different");
  assert.equal(different?.title, "Try something different");
  assert.ok(different && different.cards.length >= 3);
  assert.equal(
    different.cards.some((c) => /rice/i.test(c.topDish?.name ?? "")),
    false,
  );
  const favourites = buildHomeSections(HUGE, { ...options, openness: "favourites" as const });
  assert.equal(
    favourites.some((s) => s.id === "different"),
    false,
  );
});

test("dishes the diner has had make a Just for you section even before a palate is trusted", () => {
  const sections = buildHomeSections(NO_MENUS, {
    hour: 12,
    familiarNames: ["roti prata"],
    maxSections: 10,
  });
  const lead = sections.find((section) => section.id === "recommended");
  assert.equal(lead?.title, "Just for you");
  assert.ok(lead?.cards[0]?.venue.id.startsWith("curry"));
});

test("the hour's section follows the diner's own meal times", async () => {
  const { dinerMealAt, hourSectionTitle } = await import("./homeSections");
  // Lunch at 13:00: from 12:00 to 14:59 it is their lunch.
  assert.equal(dinerMealAt(12, { lunch: "13:00" }), "lunch");
  assert.equal(dinerMealAt(14, { lunch: "13:00" }), "lunch");
  assert.equal(dinerMealAt(15, { lunch: "13:00" }), undefined);
  // Supper past midnight wraps round.
  assert.equal(dinerMealAt(23, { supper: "00:30" }), "supper");
  assert.equal(dinerMealAt(9, undefined), undefined);
  assert.equal(hourSectionTitle(15, false, "lunch"), "Lunch nearby");
  assert.equal(hourSectionTitle(23, true, "supper"), "Supper here");
  assert.equal(hourSectionTitle(23, false), "Late night");
});

test("stall history: a hidden stall is in no section and a liked stall's food counts as familiar", () => {
  const sections = buildHomeSections(BIG, {
    hour: 19,
    hiddenVenueIds: new Set(["4-0"]),
    stallScores: new Map([["2-1", 0.8]]),
  });
  const shown = sections.flatMap((section) => section.cards.map((c) => c.venue.id));
  assert.ok(!shown.includes("4-0"), "Not for me hides the stall");
  const recommended = sections.find((section) => section.id === "recommended");
  assert.ok(recommended, "a liked stall gives Just for you something to go on");
  assert.equal(recommended.cards[0].topDish?.name, "Chicken Rice");
});
