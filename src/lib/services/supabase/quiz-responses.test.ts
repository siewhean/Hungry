import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("supabase saves taste quiz answers to quiz_responses for signed-in users only", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const start = service.indexOf("async recordQuizResponse(");
  const method = service.slice(start, service.indexOf("\n    },\n", start));
  assert.match(method, /if \(!client\) return;/);
  // r2 onboarding-L12: failures throw, so a queued guest quiz is not cleared before it is saved.
  assert.match(method, /if \(!userId\) throw new Error\(/);
  assert.match(method, /if \(error\) throw error;/);
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

test("queued quiz answers are cleared only after the server accepted them, and flush runs once at a time", () => {
  const helper = read("src/features/profile/pendingQuizResponse.ts");
  const flush = helper.slice(helper.indexOf("export function flushPendingQuizResponse"));
  // The clear comes after the awaited write, never before it.
  assert.match(
    flush,
    /await getHungryService\(\)\.profile\.recordQuizResponse\(saved\.responses, saved\.tasteVector\);\s*\/\/[^\n]*\n\s*if \(pending === saved\) clearPending\(\);/,
  );
  assert.match(flush, /if \(flushInFlight\) return flushInFlight;/);
  assert.match(flush, /\} catch \{\s*\/\/ Kept on the device/);

  // The dietary Continue cannot double-insert: handleFinish runs once per visit.
  const screen = read("src/app/screens/onboarding/TasteQuizScreen.tsx");
  assert.match(screen, /if \(finishedRef\.current\) return;\s*finishedRef\.current = true;/);
  assert.match(screen, /navigation\.addListener\("focus"/);
});
