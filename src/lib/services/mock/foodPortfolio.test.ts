// The mock Food Portfolio service: top three, pins, stalls and the Following feed behave like the
// Supabase RPCs, so screens built on mock data match production.

import assert from "node:assert/strict";
import test from "node:test";

import { hungryService } from "@/lib/services/mock/mockService";
import {
  mergePortfolioPosts,
  portfolioPostImage,
} from "@/features/foodPortfolio/foodPortfolioLoaders";
import type { Bite } from "@/lib/services/types";

test("the top three is the most liked first when nothing is pinned", async () => {
  const { posts, pinnedPostIds } = await hungryService.foodPortfolio.getTopPosts("user-emma");
  assert.ok(posts.length > 0 && posts.length <= 3);
  assert.deepEqual(pinnedPostIds, []);
  for (let i = 1; i < posts.length; i += 1) {
    assert.ok(posts[i - 1].cravingCount >= posts[i].cravingCount, "most liked first");
  }
  assert.ok(posts.every((post) => post.authorId === "user-emma"));
});

test("pins keep only your own posts, in order, and lead the top three", async () => {
  const profile = await hungryService.profile.getProfile();
  const first = await hungryService.social.postBite({
    dishId: "dish-chicken-rice",
    venueId: "venue-tian-tian",
    photoUrl: "https://example.com/one.jpg",
    caption: "First",
    rating: 0,
  } as never);
  // Mock post ids come from the clock: let it tick so the two posts differ.
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await hungryService.social.postBite({
    dishId: "dish-chicken-rice",
    venueId: "venue-tian-tian",
    photoUrl: "https://example.com/two.jpg",
    caption: "Second",
    rating: 0,
  } as never);
  const kept = await hungryService.foodPortfolio.setPinnedPosts([
    second.id,
    "bite-feed-mock-wei",
    first.id,
  ]);
  assert.deepEqual(kept, [second.id, first.id], "someone else's post is dropped");
  const top = await hungryService.foodPortfolio.getTopPosts(profile.id);
  assert.deepEqual(
    top.posts.slice(0, 2).map((post) => post.id),
    [second.id, first.id],
  );
  assert.deepEqual(top.pinnedPostIds, [second.id, first.id]);
  await assert.rejects(hungryService.foodPortfolio.setPinnedPosts(["a", "b", "c", "d"]));

  const stalls = await hungryService.foodPortfolio.listStalls(profile.id);
  const tianTian = stalls.find((stall) => stall.venueId === "venue-tian-tian");
  assert.ok(tianTian && tianTian.dishCount >= 2, "both posts count at the stall");
});

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
