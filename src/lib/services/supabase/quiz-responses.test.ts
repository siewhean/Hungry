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

test("taste quiz finish waits for one confirmed preference commit", () => {
  const screen = read("src/app/screens/onboarding/TasteQuizScreen.tsx");
  const commit = read("src/features/onboarding/commitQuizProfile.ts");
  assert.match(screen, /await commitQuizProfile/);
  assert.doesNotMatch(screen, /void getHungryService\(\)\s*\.profile\.recordQuizResponse/);
  assert.match(commit, /await dependencies\.save\(updates\)/);
});
