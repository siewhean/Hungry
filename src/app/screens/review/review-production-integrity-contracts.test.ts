import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const reviewScreen = read("src/app/screens/review/ReviewScreen.tsx");
const quickReviewSheet = read("src/app/screens/review/QuickReviewSheet.tsx");
const mediaPicker = read("src/components/review/MediaPicker.tsx");
const supabaseService = read("src/lib/services/supabase/supabaseService.ts");

test("review recommendation choice is persisted by the production service", () => {
  assert.match(reviewScreen, /recommend: draft\.recommend/);
  assert.match(supabaseService, /would_recommend: draft\.recommend \?\? true/);
});

test("unpersisted review video, filters, and music fail closed in production", () => {
  assert.match(
    reviewScreen,
    /const reviewRichMediaEnabled = FEATURE_FLAGS\.reviewRichMediaEnabled/,
  );
  assert.match(reviewScreen, /richMediaEnabled=\{reviewRichMediaEnabled\}/);
  assert.match(
    reviewScreen,
    /\{reviewRichMediaEnabled \? \([\s\S]*<AppText variant="h3">Music<\/AppText>/,
  );
  assert.match(mediaPicker, /richMediaEnabled = false/);
  assert.match(mediaPicker, /\{richMediaEnabled \? \([\s\S]*Add Reel/);
  assert.match(mediaPicker, /\{richMediaEnabled && editingUri \? \(/);
});

test("review pickers retain the exact source-backed dish and quick review performs a real write", () => {
  assert.match(reviewScreen, /hungryService\.discovery\s*\.searchDishes\(/);
  assert.match(reviewScreen, /actions\.selectDish\(item\.venueId, item\.id\)/);
  assert.doesNotMatch(reviewScreen, /listDishesByVenue\(item\.id\)/);
  assert.doesNotMatch(reviewScreen, /dishes\[0\]/);

  assert.match(quickReviewSheet, /getHungryService\(\)\.reviews\.submitReview\(/);
  assert.doesNotMatch(quickReviewSheet, /new Promise\(\(resolve\) => setTimeout/);
});
