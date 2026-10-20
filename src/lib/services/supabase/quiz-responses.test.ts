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
  // Each row says which version of the quiz produced it.
  assert.match(method, /quiz_version: TASTE_QUIZ_VERSION/);
});

test("taste quiz finish records its answers without blocking navigation", () => {
  const screen = read("src/app/screens/onboarding/TasteQuizScreen.tsx");
  const helper = read("src/features/profile/pendingQuizResponse.ts");
  assert.match(screen, /recordQuizResponse\(\s*\{/);
  assert.doesNotMatch(screen, /await [\s\S]*recordQuizResponse/);
  // Signed in: saved now, fire-and-forget. Guest: kept on the device until sign-in.
  assert.match(
    helper,
    /isAuthenticated\) \{\s*void getHungryService\(\)\s*\.profile\.recordQuizResponse\(responses, tasteVector\)\s*\.catch\(\(\) => undefined\)/,
  );
  assert.match(helper, /hungryPersistStorage\?\.setItem\(STORAGE_KEY/);
  assert.match(
    read("src/features/auth/applySignedInProfile.ts"),
    /void flushPendingQuizResponse\(\)/,
  );
});
