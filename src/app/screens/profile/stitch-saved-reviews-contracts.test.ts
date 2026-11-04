import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

test("Stitch reviews use the viewer's real review data and preserve review actions", () => {
  const source = read("src/app/screens/profile/ReviewHistoryScreen.tsx");

  // The list is shared review cards; mock-mode entries carry the on-device rating, text and tags.
  assert.match(source, /rating: entry\?\.rating \?\? 0/);
  assert.match(source, /text: entry\?\.text \?\? ""/);
  assert.match(source, /<ProfileReviewCard/);
  assert.match(
    read("src/components/profile/ProfileReviewCard.tsx"),
    /review\.photos\[0\] \?\? \(dish\.status === "ready" \? dish\.imageUrl : undefined\)/,
  );
  assert.match(source, /getUserReviews\(profile\.id/);
  assert.match(source, /ownReviewEditor\.openActions\(review\)/);
  assert.match(source, /navigate\("DishDetail", \{\s*dishId,\s*source: "review_history",?\s*\}\)/);
  assert.doesNotMatch(source, /1\.4k|42 reviewed|4\.8 avg/i);
});

test("Stitch saved dishes keep live saved state and use safe directions", () => {
  const source = read("src/app/screens/profile/SavedDishesSection.tsx");
  const card = read("src/components/saved/SavedDishCard.tsx");

  assert.match(source, /toggleFavourite\(input, \{ surface: "saved" \}\)/);
  assert.match(source, /preloadRoute\(rootNavigation, "DishDetail", \{ dishId: dish\.id \}\)/);
  assert.match(source, /openTrustedMapsUrl\(url\)/);
  assert.match(source, /buildSavedDirectionsUrl\(dish\)/);
  assert.match(source, /navigate\("DishDetail", \{\s*dishId: dish\.id,\s*source: "saved"/);
  assert.doesNotMatch(source + card, /Open now|No queue|Saved 3d ago|350m away/);
});
