import assert from "node:assert/strict";
import test from "node:test";

import { supabaseRepository } from "@/lib/services/supabase/supabaseRepository";

test("supabase repository does not fall back to mock dataset before hydration", () => {
  const actual = supabaseRepository.listBuildings();
  assert.deepEqual(actual, []);
});

test("supabase repository returns undefined for detail reads before hydration", () => {
  const detail = supabaseRepository.getDishById("non-existent-dish");
  assert.equal(detail, undefined);
});
