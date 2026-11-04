import assert from "node:assert/strict";
import test from "node:test";

import { parseSearchQuery } from "@/features/search/queryParser";

function parse(raw: string, dismissed: string[] = []) {
  const result = parseSearchQuery(raw, new Set(dismissed));
  return {
    text: result.text,
    dietary: result.dietary,
    maxPrice: result.maxPrice,
    keys: result.parts.map((part) => part.key),
  };
}

test("plain text is left alone", () => {
  assert.deepEqual(parse("laksa"), { text: "laksa", dietary: [], maxPrice: undefined, keys: [] });
  assert.deepEqual(parse("  chicken   rice "), {
    text: "chicken rice",
    dietary: [],
    maxPrice: undefined,
    keys: [],
  });
  assert.deepEqual(parse(""), { text: "", dietary: [], maxPrice: undefined, keys: [] });
});

test("halal, vegetarian and vegan become dietary parts and leave the rest as text", () => {
  assert.deepEqual(parse("halal laksa"), {
    text: "laksa",
    dietary: ["halal"],
    maxPrice: undefined,
    keys: ["dietary:halal"],
  });
  assert.deepEqual(parse("Laksa HALAL"), {
    text: "Laksa",
    dietary: ["halal"],
    maxPrice: undefined,
    keys: ["dietary:halal"],
  });
  assert.deepEqual(parse("vegetarian bee hoon").dietary, ["vegetarian"]);
  assert.deepEqual(parse("vegan ramen").dietary, ["vegan"]);
  assert.equal(parse("halal, laksa").text, "laksa");
});

test("a query that is only a filter leaves no text", () => {
  assert.deepEqual(parse("halal"), {
    text: "",
    dietary: ["halal"],
    maxPrice: undefined,
    keys: ["dietary:halal"],
  });
  assert.equal(parse("under $5").text, "");
});

test("no pork and pork free are one part, however they are written", () => {
  for (const raw of [
    "no pork noodles",
    "noodles pork free",
    "noodles pork-free",
    "noodles porkfree",
  ]) {
    const result = parse(raw);
    assert.deepEqual(result.dietary, ["pork_free"], raw);
    assert.equal(result.text, "noodles", raw);
  }
  // "no" and "pork" on their own are ordinary words.
  assert.deepEqual(parse("pork rib"), {
    text: "pork rib",
    dietary: [],
    maxPrice: undefined,
    keys: [],
  });
  assert.equal(parse("no 1 chicken rice").text, "no 1 chicken rice");
});

test("the same flag twice is one part", () => {
  const result = parse("halal halal laksa");
  assert.deepEqual(result.dietary, ["halal"]);
  assert.deepEqual(result.keys, ["dietary:halal"]);
  assert.equal(result.text, "laksa");
});

test("price words set a cap of any size", () => {
  const cases: [string, number][] = [
    ["laksa under $5", 5],
    ["laksa under 5", 5],
    ["laksa under5", 5],
    ["laksa under$5", 5],
    ["laksa below $7.50", 7.5],
    ["laksa less than 8", 8],
    ["laksa less than $8 dollars", 8],
    ["laksa <5", 5],
    ["laksa < 5", 5],
    ["laksa <= $5", 5],
    ["laksa under S$10", 10],
    ["laksa under 5 bucks", 5],
  ];
  for (const [raw, cap] of cases) {
    const result = parse(raw);
    assert.equal(result.maxPrice, cap, raw);
    assert.equal(result.text, "laksa", raw);
  }
});

test("a bare dollar amount at either end is a cap", () => {
  assert.deepEqual(parse("$5 laksa"), {
    text: "laksa",
    dietary: [],
    maxPrice: 5,
    keys: ["price:5"],
  });
  assert.equal(parse("laksa $5").maxPrice, 5);
  assert.equal(parse("laksa $5 or less").text, "laksa");
  assert.equal(parse("$5 and below laksa").maxPrice, 5);
  // In the middle of a query a dollar sign is not enough to be sure.
  assert.deepEqual(parse("fried $5 rice").maxPrice, undefined);
});

test("numbers that are not prices are text", () => {
  assert.equal(parse("7 spice chicken").text, "7 spice chicken");
  assert.equal(parse("99 chicken rice").maxPrice, undefined);
  assert.equal(parse("under the bridge").text, "under the bridge");
  assert.equal(parse("under").text, "under");
  assert.equal(parse("under $0").maxPrice, undefined);
  assert.equal(parse("under $500").maxPrice, undefined);
  assert.equal(parse("under $5.555").maxPrice, undefined);
  assert.equal(parse("under -5").maxPrice, undefined);
  assert.equal(parse("under 5x").maxPrice, undefined);
});

test("only the first price counts; a second stays as text", () => {
  const result = parse("laksa under $5 under $8");
  assert.equal(result.maxPrice, 5);
  assert.equal(result.text, "laksa under $8");
});

test("look-alikes are not parsed", () => {
  assert.equal(parse("halal-ish noodles").dietary.length, 0);
  assert.equal(parse("halal-ish noodles").text, "halal-ish noodles");
  assert.equal(parse("nonhalal").dietary.length, 0);
  assert.equal(parse("veganism").dietary.length, 0);
});

test("filters and price combine, in any order", () => {
  const result = parse("under $6 halal laksa");
  assert.deepEqual(result, {
    text: "laksa",
    dietary: ["halal"],
    maxPrice: 6,
    keys: ["price:6", "dietary:halal"],
  });
  assert.equal(parse("laksa halal under 6").text, "laksa");
});

test("a dismissed part is searched for as plain text", () => {
  assert.deepEqual(parse("halal laksa", ["dietary:halal"]), {
    text: "halal laksa",
    dietary: [],
    maxPrice: undefined,
    keys: [],
  });
  assert.deepEqual(parse("laksa under $5", ["price:5"]), {
    text: "laksa under $5",
    dietary: [],
    maxPrice: undefined,
    keys: [],
  });
  // Dismissing one part keeps the others.
  assert.deepEqual(parse("halal laksa under $5", ["dietary:halal"]), {
    text: "halal laksa",
    dietary: [],
    maxPrice: 5,
    keys: ["price:5"],
  });
  // A dismissal is for that exact part: another cap still applies.
  assert.equal(parse("laksa under $6", ["price:5"]).maxPrice, 6);
});

test("labels read like the filter chips", () => {
  const labels = (raw: string) => parseSearchQuery(raw).parts.map((part) => part.label);
  assert.deepEqual(labels("halal under 5"), ["Halal", "Under S$5"]);
  assert.deepEqual(labels("under 5.5"), ["Under S$5.50"]);
  assert.deepEqual(labels("no pork"), ["No pork"]);
  assert.deepEqual(labels("vegan"), ["Vegan"]);
  assert.equal(parseSearchQuery("laksa under $5").parts[0]?.source, "under $5");
});

test("emoji, punctuation and other scripts pass through", () => {
  assert.equal(parse("🍜 laksa").text, "🍜 laksa");
  assert.equal(parse("🍜 halal").text, "🍜");
  assert.equal(parse("海南鸡饭").text, "海南鸡饭");
  assert.equal(parse("mcdonald's").text, "mcdonald's");
  assert.equal(parse("%%").text, "%%");
});
