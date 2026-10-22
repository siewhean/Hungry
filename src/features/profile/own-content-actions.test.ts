import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { hungryService } from "@/lib/services/mock/mockService";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const TASTE = { sweet: 1, spicy: 1, sour: 1, salty: 1, rich: 1, aromatic: 1 };

test("H37: the author can edit and delete their own post (mock)", async () => {
  const bite = await hungryService.social.postBite({
    dishId: "dish-own-content-test",
    venueId: "venue-own-content-test",
    photoUrl: "https://example.com/own.jpg",
    caption: "First caption",
    tasteStamp: TASTE,
    rating: 4,
  });

  await hungryService.social.updatePost(bite.id, { caption: "  Edited <b>caption</b>  " });
  assert.equal((await hungryService.social.getPostById(bite.id))?.caption, "Edited caption");

  await hungryService.social.deletePost(bite.id);
  assert.equal(await hungryService.social.getPostById(bite.id), null);
  await assert.rejects(() => hungryService.social.deletePost(bite.id));
});

test("H37: nobody edits or deletes someone else's post (mock)", async () => {
  const feed = await hungryService.social.getBitesFeed();
  const profile = await hungryService.profile.getProfile();
  const foreign = feed.find((bite) => bite.authorId !== profile.id);
  assert.ok(foreign);
  await assert.rejects(() => hungryService.social.updatePost(foreign.id, { caption: "x" }));
  await assert.rejects(() => hungryService.social.deletePost(foreign.id));
  assert.ok(await hungryService.social.getPostById(foreign.id));
});

test("H37: Supabase post edit/delete is owner-scoped and a soft delete", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const update = /async updatePost\(postId, patch\) \{[\s\S]*?\n    \},/.exec(service)?.[0];
  const remove = /async deletePost\(postId\) \{[\s\S]*?\n    \},/.exec(service)?.[0];
  assert.ok(update && remove);
  for (const body of [update, remove]) {
    assert.match(body, /\.eq\("author_id", userId\)/);
    assert.match(body, /\.is\("deleted_at", null\)/);
    assert.match(body, /if \(count === 0\) throw/);
  }
  assert.match(update, /sanitizeFreeText\(patch\.caption, POST_CAPTION_MAX_LENGTH\)/);
  // Soft delete keeps reports and moderation history attached.
  assert.match(remove, /\.update\(\{ deleted_at: new Date\(\)\.toISOString\(\) \}/);
  assert.doesNotMatch(remove, /\.delete\(\)/);
});

test("H37: own posts and reviews get Edit/Delete entry points", () => {
  const detail = read("src/app/screens/home/ActivityPostDetailScreen.tsx");
  assert.match(detail, /isOwnPost\s*\?\s*promptOwnContentActions\(\{\s*label: "post"/);
  assert.match(detail, /getHungryService\(\)\.social\.deletePost\(postId\)/);
  assert.match(detail, /getHungryService\(\)\.social\.updatePost\(postId, \{ caption: text \}\)/);
  assert.match(detail, /markPostRemovedForSession\(postId\)/);

  const actions = read("src/features/profile/ownContentActions.ts");
  // Built against the reviews data layer owned by H33 (group D).
  assert.match(actions, /updateReview\?: \(reviewId: string, patch: OwnReviewPatch\)/);
  assert.match(actions, /deleteReview\?: \(reviewId: string\)/);

  for (const path of [
    "src/app/screens/profile/ProfileHomeScreen.tsx",
    "src/app/screens/profile/ReviewHistoryScreen.tsx",
  ]) {
    const screen = read(path);
    assert.match(screen, /useOwnReviewEditor\(\{/, path);
    assert.match(screen, /ownReviewEditor\.enabled/, path);
    assert.match(screen, /ownReviewEditor\.openActions\(review\)/, path);
    assert.match(screen, /\{ownReviewEditor\.dialog\}/, path);
  }
});
