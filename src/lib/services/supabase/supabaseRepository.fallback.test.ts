import assert from "node:assert/strict";
import test from "node:test";

import { mockRepository } from "@/lib/services/mock/repositories";
import { supabaseRepository } from "@/lib/services/supabase/supabaseRepository";

test("supabase repository falls back to mock dataset before supabase hydration", () => {
  const expected = mockRepository.listBuildings().map((building) => building.id);
  const actual = supabaseRepository.listBuildings().map((building) => building.id);
  assert.deepEqual(actual, expected);
});

test("supabase repository fallback supports detail reads", () => {
  const targetDish = mockRepository.listPopularNearby()[0];
  const detail = supabaseRepository.getDishById(targetDish.id);
  assert.ok(detail, "Expected fallback dish detail to be available.");
  assert.equal(detail?.id, targetDish.id);
});
