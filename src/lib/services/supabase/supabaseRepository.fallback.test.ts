import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("getProfile does not start the legacy catalog download at app start", () => {
  const source = readFileSync("src/lib/services/supabase/supabaseRepository.ts", "utf8");
  const body = source.match(/getProfile\(isAuthenticated: boolean[\s\S]*?\n {2}\},/)?.[0] ?? "";
  assert.ok(body.length > 0, "getProfile body not found");
  assert.doesNotMatch(body, /ensureHydrated\(\)/);
});
