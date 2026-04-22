import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Sprint 9 screen contract: Login screen uses service auth + error boundary", () => {
  const source = read("src/app/screens/auth/LoginScreen.tsx");

  assert.match(source, /getHungryService\(\)\.auth\.signIn\(/);
  assert.match(source, /getHungryService\(\)\.auth\.signInWithGoogle\(/);
  assert.match(source, /getHungryService\(\)\.auth\.signInWithApple\(/);
  assert.match(source, /<FeedErrorBoundary/);
});

test("Sprint 9 screen contract: Review screen submits via service and triggers success UI", () => {
  const source = read("src/app/screens/review/ReviewScreen.tsx");

  assert.match(source, /getHungryService\(\)\.reviews\.submitReview\(/);
  assert.match(source, /showReviewSuccess\(/);
  assert.match(source, /showToast\(\{ message: "Review posted!"/);
  assert.match(source, /<FeedErrorBoundary/);
});

test("Sprint 9 screen contract: Home feed interactions are wired for like/save/comment/share", () => {
  const source = read("src/app/screens/home/HomeFeedScreen.tsx");

  assert.match(source, /const toggleLike = useCallback/);
  assert.match(source, /const toggleSave = useCallback/);
  assert.match(source, /Share\.share\(/);
  assert.match(source, /commentsSheetRef\.current\?\.present\(\)/);
  assert.match(source, /<BottomSheetModal/);
});

test("Sprint 9 screen contract: routed dish detail uses gallery-backed share flow", () => {
  const source = read("src/app/screens/detail/DishDetailScreen.tsx");
  const navigatorSource = read("src/app/navigation/RootNavigator.tsx");

  assert.match(source, /const repository = getDataRepository\(\)/);
  assert.match(source, /buildDishGallery\(dish\)/);
  assert.match(source, /const canonicalDishUrl = `https:\/\/hungry\.sg\/dish\/\$\{dish\.id\}`/);
  assert.match(source, /Share\.share\(\{/);
  assert.match(source, /<ImageCarousel/);
  assert.match(navigatorSource, /component=\{DishDetailScreen\} name=\"DishDetail\"/);
});
