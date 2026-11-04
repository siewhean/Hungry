import assert from "node:assert/strict";
import test from "node:test";

import { ALL_PASSPORT_CATEGORIES } from "@/constants/passportConfig";
import { stallMatchesCategory } from "@/features/passport/stampMatching";
import type { StallStampFacts } from "@/types/domain";

function facts(overrides: Partial<StallStampFacts>): StallStampFacts {
  return { stallId: "s1", cuisineTags: [], ...overrides };
}

function matched(stall: StallStampFacts): string[] {
  return ALL_PASSPORT_CATEGORIES.filter((category) => stallMatchesCategory(stall, category)).map(
    (category) => category.id,
  );
}

test("a stall in a hawker centre counts toward Hawker, whatever it sells", () => {
  assert.deepEqual(matched(facts({ buildingType: "hawker_centre", cuisineTags: ["chinese"] })), [
    "cuisine-hawker",
    "cuisine-chinese",
  ]);
  assert.deepEqual(matched(facts({ buildingType: "mall" })), []);
});

test("cuisine tags map to the cuisine categories, including the narrower ones", () => {
  assert.deepEqual(matched(facts({ cuisineTags: ["ramen"] })), ["cuisine-japanese"]);
  assert.deepEqual(matched(facts({ cuisineTags: ["dim_sum"] })), ["cuisine-chinese"]);
  assert.deepEqual(matched(facts({ cuisineTags: ["burger"] })), ["cuisine-western"]);
  assert.deepEqual(matched(facts({ cuisineTags: ["indian"] })), ["cuisine-indian"]);
  assert.deepEqual(matched(facts({ cuisineTags: ["nasi_lemak"] })), ["cuisine-malay"]);
  assert.deepEqual(matched(facts({ cuisineTags: ["cafe", "bakery"] })), []);
});

test("neighbourhoods match on planning area, or on the building name and address", () => {
  assert.deepEqual(matched(facts({ planningArea: "Chinatown" })), ["hood-chinatown"]);
  assert.deepEqual(matched(facts({ planningArea: "Tampines" })), ["hood-tampines"]);
  assert.deepEqual(matched(facts({ planningArea: "Marina Bay" })), ["hood-cbd"]);
  assert.deepEqual(matched(facts({ placeText: "Bugis Junction 200 Victoria St" })), ["hood-bugis"]);
  assert.deepEqual(matched(facts({ placeText: "Tiong Bahru Market" })), ["hood-tiong-bahru"]);
  assert.deepEqual(matched(facts({ planningArea: "Bedok" })), []);
});

test("an unknown match tag matches nothing", () => {
  assert.equal(
    stallMatchesCategory(facts({ cuisineTags: ["chinese"] }), { matchTag: "nope" }),
    false,
  );
});
