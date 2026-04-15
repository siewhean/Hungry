import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { userProfile } from "./data";
import { mockRepository } from "./repositories";

test("getDecideForMe respects dietary restrictions", () => {
  const pick = mockRepository.getDecideForMe(NEUTRAL_TASTE_VECTOR, {
    dietaryFlags: ["vegetarian"],
    radiusMeters: 4000,
  });

  assert.ok(pick, "Expected a recommendation for vegetarian filters");
  assert.equal(
    pick.dietaryFlags.includes("vegetarian"),
    true,
    "Recommended dish must satisfy vegetarian flag",
  );
});

test("getDecideForMe excludes already shown dishes", () => {
  const initialPick = mockRepository.getDecideForMe(userProfile.tasteVector, {
    radiusMeters: 500,
  });

  assert.ok(initialPick, "Expected a baseline recommendation");

  const nextPick = mockRepository.getDecideForMe(userProfile.tasteVector, {
    radiusMeters: 500,
    excludeDishIds: [initialPick.id],
  });

  if (nextPick) {
    assert.notEqual(
      nextPick.id,
      initialPick.id,
      "Excluded dish should not be returned again",
    );
  }
});
