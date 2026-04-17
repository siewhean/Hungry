import assert from "node:assert/strict";
import test from "node:test";

import type { SearchFilters } from "@/types/domain";
import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { guestProfile, userProfile } from "./data";
import { mockRepository } from "./repositories";

function sortIds(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

test("repositories: getProfile returns authenticated and guest identities correctly", () => {
  const authenticated = mockRepository.getProfile(true);
  const guest = mockRepository.getProfile(false);

  assert.equal(authenticated.id, userProfile.id);
  assert.equal(guest.id, guestProfile.id);
});

test("repositories: building alias resolution returns same venue set for canonical and alias ids", () => {
  const canonical = mockRepository.listVenuesByBuilding("building-maxwell");
  const alias = mockRepository.listVenuesByBuilding("hc-maxwell");
  const reverseAlias = mockRepository.listVenuesByBuilding("building-lau-pa-sat");
  const reverseCanonical = mockRepository.listVenuesByBuilding("hc-lau-pa-sat");

  assert.ok(canonical.length > 0);
  assert.deepEqual(
    sortIds(canonical.map((venue) => venue.id)),
    sortIds(alias.map((venue) => venue.id)),
  );
  assert.deepEqual(
    sortIds(reverseAlias.map((venue) => venue.id)),
    sortIds(reverseCanonical.map((venue) => venue.id)),
  );
});

test("repositories: searchDishes enforces dietary + radius filters and keeps deterministic ordering", () => {
  const filters: SearchFilters = {
    query: "",
    categories: [],
    dietaryFlags: ["vegetarian"],
    tasteValues: NEUTRAL_TASTE_VECTOR,
    radius: 3000,
  };

  const results = mockRepository.searchDishes(filters, NEUTRAL_TASTE_VECTOR);

  assert.ok(results.length > 0, "Expected at least one vegetarian dish within radius");
  assert.ok(results.every((dish) => dish.distanceMeters <= filters.radius));
  assert.ok(results.every((dish) => dish.dietaryFlags.includes("vegetarian")));

  const idsFirstPass = results.map((dish) => dish.id);
  const idsSecondPass = mockRepository
    .searchDishes(filters, NEUTRAL_TASTE_VECTOR)
    .map((dish) => dish.id);
  assert.deepEqual(idsSecondPass, idsFirstPass);
});

test("repositories: searchDishes honors explicit filter tasteValues over profile fallback", () => {
  const filters: SearchFilters = {
    query: "",
    categories: [],
    dietaryFlags: [],
    tasteValues: {
      ...NEUTRAL_TASTE_VECTOR,
      spicy: 10,
      aromatic: 10,
    },
    radius: 3000,
  };

  const resultsFromNeutralProfile = mockRepository.searchDishes(filters, NEUTRAL_TASTE_VECTOR);
  const resultsFromUserProfile = mockRepository.searchDishes(filters, userProfile.tasteVector);

  assert.ok(resultsFromNeutralProfile.length > 0);
  assert.deepEqual(
    resultsFromNeutralProfile.map((dish) => dish.id),
    resultsFromUserProfile.map((dish) => dish.id),
  );
});

test("repositories: listPopularNearby returns 4 nearest dishes sorted by distance", () => {
  const popular = mockRepository.listPopularNearby();
  assert.equal(popular.length, 4);

  for (let index = 1; index < popular.length; index += 1) {
    assert.ok(popular[index - 1].distanceMeters <= popular[index].distanceMeters);
  }
});

test("repositories: getDecideForMe respects excludeDishIds", () => {
  const initial = mockRepository.getDecideForMe(userProfile.tasteVector, {
    radiusMeters: 1200,
  });
  assert.ok(initial, "Expected a recommendation");

  const next = mockRepository.getDecideForMe(userProfile.tasteVector, {
    radiusMeters: 1200,
    excludeDishIds: [initial.id],
  });

  if (next) {
    assert.notEqual(next.id, initial.id);
  }
});
