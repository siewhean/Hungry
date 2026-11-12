// The mock Food Portfolio service: picks, the diary, stalls and the Following feed behave like the
// Supabase RPCs, so screens built on mock data match production.

import assert from "node:assert/strict";
import test from "node:test";

import { hungryService } from "@/lib/services/mock/mockService";
import {
  mergePortfolioPosts,
  portfolioPostImage,
} from "@/features/foodPortfolio/foodPortfolioLoaders";
import type { Bite } from "@/lib/services/types";

test("the Following feed shows only people you follow, newest first, and pages by cursor", async () => {
  assert.deepEqual(
    (await hungryService.foodPortfolio.getFollowingFeed()).filter(
      (post) => post.authorId === "user-sarah",
    ),
    [],
    "nobody followed yet",
  );
  await hungryService.social.followUser("user-sarah");
  await hungryService.social.followUser("user-wei-ming");
  const feed = await hungryService.foodPortfolio.getFollowingFeed({ limit: 50 });
  assert.ok(feed.length >= 2);
  assert.ok(feed.every((post) => ["user-sarah", "user-wei-ming"].includes(post.authorId)));
  for (let i = 1; i < feed.length; i += 1) {
    assert.ok(Date.parse(feed[i - 1].createdAt) >= Date.parse(feed[i].createdAt));
  }
  const firstPage = await hungryService.foodPortfolio.getFollowingFeed({ limit: 1 });
  const last = firstPage[0];
  const nextPage = await hungryService.foodPortfolio.getFollowingFeed({
    limit: 10,
    cursor: { createdAt: last.createdAt, postId: last.id },
  });
  assert.ok(!nextPage.some((post) => post.id === last.id), "the cursor post is not repeated");
  await hungryService.social.unfollowUser("user-sarah");
  await hungryService.social.unfollowUser("user-wei-ming");
});

test("mergePortfolioPosts appends without repeating, portfolioPostImage prefers the first media", () => {
  const a = { id: "a", mediaUrls: ["", "https://x/a2.jpg"], photoUrl: "https://x/a.jpg" } as Bite;
  const b = { id: "b", photoUrl: "https://x/b.jpg" } as Bite;
  const c = { id: "c", photoUrl: "" } as Bite;
  assert.deepEqual(
    mergePortfolioPosts([a, b], [b, c]).map((post) => post.id),
    ["a", "b", "c"],
  );
  assert.equal(portfolioPostImage(a), "https://x/a2.jpg");
  assert.equal(portfolioPostImage(b), "https://x/b.jpg");
  assert.equal(portfolioPostImage(c), undefined);
});

test("picks: a best per dish type, a top three, and Only me entries drop out of both", async () => {
  const profile = await hungryService.profile.getProfile();
  const make = async (caption: string) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return hungryService.social.postBite({
      dishId: "dish-chicken-rice",
      venueId: "venue-tian-tian",
      photoUrl: "https://example.com/pick.jpg",
      caption,
      rating: 0,
    } as never);
  };
  const a = await make("pick a");
  const b = await make("pick b");

  const first = await hungryService.foodPortfolio.setPick(a.id, "dish_type");
  assert.equal(first.replacedPostId, undefined);
  const second = await hungryService.foodPortfolio.setPick(b.id, "dish_type");
  assert.equal(second.replacedPostId, a.id, "the same dish type replaces the old best");
  assert.equal(second.slot, first.slot);

  await hungryService.foodPortfolio.setPick(a.id, "overall", 1);
  await hungryService.foodPortfolio.setPick(a.id, "overall", 3);
  await assert.rejects(hungryService.foodPortfolio.setPick(a.id, "overall", 4));
  let picks = await hungryService.foodPortfolio.getPicks(profile.id);
  assert.deepEqual(
    picks.topThree.map((pick) => [pick.place, pick.post.id]),
    [[3, a.id]],
    "moving within the top three frees the old place",
  );
  assert.ok(picks.bests.some((pick) => pick.post.id === b.id));

  assert.equal(await hungryService.foodPortfolio.setEntryVisibility(a.id, "private"), "private");
  picks = await hungryService.foodPortfolio.getPicks(profile.id);
  assert.equal(picks.topThree.length, 0, "Only me drops the entry's picks");
  await assert.rejects(hungryService.foodPortfolio.setPick(a.id, "overall", 1));

  const diary = await hungryService.foodPortfolio.getDiary(profile.id, { limit: 2 });
  assert.deepEqual(
    diary.map((entry) => [entry.post.id, entry.visibility]),
    [
      [b.id, "public"],
      [a.id, "private"],
    ],
    "the owner sees Only me entries, newest first",
  );
  assert.deepEqual(diary[0].pickKinds, ["dish_type"]);
  const next = await hungryService.foodPortfolio.getDiary(profile.id, {
    limit: 1,
    before: { publishedAt: diary[0].post.createdAt, id: diary[0].post.id },
  });
  assert.equal(next[0]?.post.id, a.id, "paging starts after the last entry shown");

  assert.equal(await hungryService.foodPortfolio.removePick(b.id), 1);
  await hungryService.foodPortfolio.setEntryVisibility(a.id, "public");
  assert.deepEqual(await hungryService.foodPortfolio.getReviewPortfolioLabels([a.id]), []);
});

test("other people's diaries hide Only me entries and nobody picks someone else's post", async () => {
  const diary = await hungryService.foodPortfolio.getDiary("user-emma");
  assert.ok(diary.length > 0 && diary.every((entry) => entry.visibility === "public"));
  await assert.rejects(hungryService.foodPortfolio.setPick(diary[0].post.id, "dish_type"));
  await assert.rejects(hungryService.foodPortfolio.setEntryVisibility(diary[0].post.id, "private"));
});
