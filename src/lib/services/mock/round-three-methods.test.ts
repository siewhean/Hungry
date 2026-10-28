import assert from "node:assert/strict";
import test from "node:test";

import { dishes } from "@/lib/services/mock/data";
import { hungryService } from "@/lib/services/mock/mockService";

test("setFavourite sets the asked-for state and never flips a dish already in that state", async () => {
  const dishId = dishes[0]!.id;
  const profile = hungryService.profile;
  const start = (await profile.getFavouriteDishIds()).includes(dishId);
  assert.equal(await profile.setFavourite(dishId, start), start, "no change, no toggle");
  assert.equal((await profile.getFavouriteDishIds()).includes(dishId), start);
  assert.equal(await profile.setFavourite(dishId, !start), !start);
  assert.equal((await profile.getFavouriteDishIds()).includes(dishId), !start);
  assert.equal(await profile.setFavourite(dishId, start), start);
});

test("addFavourites adds each missing dish once", async () => {
  const ids = [dishes[1]!.id, dishes[2]!.id];
  for (const id of ids) await hungryService.profile.setFavourite(id, false);
  await hungryService.profile.addFavourites([...ids, ids[0]!]);
  const saved = await hungryService.profile.getFavouriteDishIds();
  assert.deepEqual(
    ids.map((id) => saved.filter((savedId) => savedId === id).length),
    [1, 1],
  );
  await hungryService.profile.addFavourites(ids);
  assert.equal((await hungryService.profile.getFavouriteDishIds()).length, saved.length);
});

test("the photo grid page lists only reviews with photos", async () => {
  const page = await hungryService.reviews.listRecentReviewsPage({ withPhotos: true, limit: 50 });
  assert.ok(page.entries.every((entry) => entry.review.photos.length > 0));
});

test("Featured follows the explicit target state, and an unknown dish is refused", async () => {
  const outletId = "outlet-wonton-mee";
  const dish = (await hungryService.merchant.getMenu(outletId))[0]!;
  const featured = async () =>
    (await hungryService.merchant.getMenu(outletId))
      .find((entry) => entry.id === dish.id)!
      .availabilityFlags.includes("Featured");
  await hungryService.merchant.toggleFeatured(outletId, dish.id, true);
  assert.equal(await featured(), true);
  await hungryService.merchant.toggleFeatured(outletId, dish.id, true);
  assert.equal(await featured(), true, "a retry of 'feature' does not unfeature");
  await hungryService.merchant.toggleFeatured(outletId, dish.id, false);
  assert.equal(await featured(), false);
  await assert.rejects(
    hungryService.merchant.toggleFeatured(outletId, "no-such-dish", true),
    /not found/,
  );
});

test("inbox pages use a (created_at, id) keyset, newest first", async () => {
  const outletId = "outlet-wonton-mee";
  const all = await hungryService.merchant.getInbox(outletId);
  assert.ok(all.length > 1);
  const times = all.map((entry) => new Date(entry.createdAt).getTime());
  assert.deepEqual(
    times,
    [...times].sort((a, b) => b - a),
  );
  const boundary = all[0]!;
  const after = await hungryService.merchant.getInbox(outletId, {
    before: boundary.createdAt,
    beforeId: boundary.id,
  });
  assert.equal(
    after.some((entry) => entry.id === boundary.id),
    false,
  );
  assert.equal(after.length, all.length - 1);
  const noId = await hungryService.merchant.getInbox(outletId, { before: boundary.createdAt });
  assert.ok(noId.every((entry) => new Date(entry.createdAt) < new Date(boundary.createdAt)));
  const unreplied = await hungryService.merchant.getInbox(outletId, { unrepliedOnly: true });
  assert.ok(unreplied.every((entry) => !entry.reply));
});
