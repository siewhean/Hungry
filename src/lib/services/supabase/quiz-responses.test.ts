import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("supabase saves taste quiz answers to quiz_responses for signed-in users only", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const method = service.slice(service.indexOf("async recordQuizResponse("));
  assert.match(method, /if \(!client \|\| !userId\) return;/);
  assert.match(
    method,
    /from\("quiz_responses"\)\.insert\(\{[\s\S]*generated_taste_vector: tasteVectorToArray/,
  );
});

test("taste quiz finish records its answers without blocking navigation", () => {
  const screen = read("src/app/screens/onboarding/TasteQuizScreen.tsx");
  assert.match(screen, /void getHungryService\(\)\s*\.profile\.recordQuizResponse\(/);
  assert.match(screen, /\.catch\(\(\) => undefined\)/);
});
