// A reload empties the mock's in-memory feed but not the posts it persisted. getPostById has to
// read those back, under the same public and not-blocked rules as a feed post.

import assert from "node:assert/strict";
import test from "node:test";

import { hungryService } from "@/lib/services/mock/mockService";
import {
  appendPublishedStallPost,
  findPublishedStallPost,
  listMockStallPosts,
} from "@/lib/services/mock/stallPostState";
import { dishes } from "@/lib/services/mock/data";
import type { StallPost } from "@/types/domain";

function persistedPost(id: string, overrides: Partial<StallPost> = {}): StallPost {
  return {
    id,
    authorId: `author-${id}`,
    venueId: "venue-tian-tian",
    buildingId: "building-maxwell",
    authorName: "Persisted Author",
    authorLocation: "Tian Tian Hainanese",
    authorAvatarUrl: "",
    mediaType: "photo",
    mediaUrl: "https://example.test/persisted.jpg",
    mediaUrls: ["https://example.test/persisted.jpg"],
    caption: `Persisted caption ${id}`,
    dishIds: [dishes[0]!.id],
    createdAt: new Date().toISOString(),
    publishedStatus: "published",
    visibility: "public",
    likeCount: 3,
    savedCount: 1,
    commentCount: 2,
    venueName: "Tian Tian Hainanese",
    venueUnitNumber: "#01-10",
    buildingName: "Maxwell Food Centre",
    ...overrides,
  };
}

test("getPostById returns a persisted post that is not in the in-memory feed", async () => {
  const post = persistedPost("persisted-only-1");
  await appendPublishedStallPost(post);

  const bite = await hungryService.social.getPostById(post.id);

  assert.ok(bite, "the persisted post is found");
  assert.equal(bite.id, post.id);
  assert.equal(bite.caption, post.caption);
  assert.equal(bite.authorId, post.authorId);
  assert.equal(bite.authorName, post.authorName);
  assert.equal(bite.dishId, dishes[0]!.id);
  assert.equal(bite.dishName, dishes[0]!.name);
  assert.equal(bite.venueName, "Tian Tian Hainanese");
  assert.equal(bite.unitNumber, "#01-10");
  assert.equal(bite.photoUrl, post.mediaUrl);
  assert.equal(bite.cravingCount, post.likeCount);
  assert.equal(bite.savedCount, post.savedCount);
  assert.equal(bite.createdAt, post.createdAt);
  assert.ok(Date.parse(bite.expiresAt) > Date.parse(bite.createdAt));
});

test("getPostById still returns a post from the in-memory feed", async () => {
  const bite = await hungryService.social.getPostById("bite-feed-mock-wei");
  assert.equal(bite?.id, "bite-feed-mock-wei");
});

test("getPostById returns null for an unknown id", async () => {
  assert.equal(await hungryService.social.getPostById("no-such-post"), null);
});

test("getPostById does not return a private or unpublished persisted post", async () => {
  await appendPublishedStallPost(persistedPost("persisted-private", { visibility: "private" }));
  await appendPublishedStallPost(persistedPost("persisted-draft", { publishedStatus: "draft" }));

  assert.equal(await hungryService.social.getPostById("persisted-private"), null);
  assert.equal(await hungryService.social.getPostById("persisted-draft"), null);
});

test("getPostById does not return a persisted post by a blocked author", async () => {
  const post = persistedPost("persisted-blocked");
  await appendPublishedStallPost(post);
  assert.ok(await hungryService.social.getPostById(post.id), "visible before the block");

  await hungryService.communitySafety.blockUser({ blockedUserId: post.authorId! });
  try {
    assert.equal(await hungryService.social.getPostById(post.id), null);
  } finally {
    await hungryService.communitySafety.unblockUser(post.authorId!);
  }
  assert.ok(await hungryService.social.getPostById(post.id), "visible again after the unblock");
});

test("a persisted post the viewer owns can be edited and deleted after a reload", async () => {
  const me = (await hungryService.profile.getProfile()).id;
  const post = persistedPost("persisted-owned", { authorId: me });
  await appendPublishedStallPost(post);
  assert.ok(await hungryService.social.getPostById(post.id), "found after the reload");

  await hungryService.social.updatePost(post.id, { caption: "Edited after a reload" });
  assert.equal(findPublishedStallPost(post.id)?.caption, "Edited after a reload");
  assert.equal((await hungryService.social.getPostById(post.id))?.caption, "Edited after a reload");

  await hungryService.social.deletePost(post.id);
  assert.equal(findPublishedStallPost(post.id), undefined, "the stored record is gone");
  assert.equal(await hungryService.social.getPostById(post.id), null);
  await assert.rejects(() => hungryService.social.deletePost(post.id), /already deleted/);
});

test("a persisted post by someone else cannot be edited or deleted", async () => {
  const post = persistedPost("persisted-not-mine");
  await appendPublishedStallPost(post);

  await assert.rejects(
    () => hungryService.social.updatePost(post.id, { caption: "Not yours" }),
    /can no longer be edited/,
  );
  await assert.rejects(() => hungryService.social.deletePost(post.id), /already deleted/);
  assert.equal(findPublishedStallPost(post.id)?.caption, post.caption, "left untouched");
});

// A reload keeps what was persisted and drops what lived only in memory. A second copy of the
// mock service module stands in for the reloaded app: its feed and private-post set start empty
// while the stored posts (stallPostState) carry over.
function reloadedService(): typeof hungryService {
  const modulePath = require.resolve("@/lib/services/mock/mockService");
  delete require.cache[modulePath];
  return (require(modulePath) as { hungryService: typeof hungryService }).hungryService;
}

test("a review published as private is not returned by getPostById after a reload", async () => {
  const dish = dishes[0]!;
  const venueId = "venue-tian-tian";
  const { portfolioPostId } = await hungryService.reviews.submitReview({
    dishId: dish.id,
    venueId,
    rating: 4,
    text: "Private portfolio review for the reload test",
    tags: [],
    photos: ["https://example.test/private.jpg"],
    portfolio: {
      caption: "Only me",
      tasteStamp: { sweet: 1, spicy: 1, sour: 1, salty: 1, rich: 1, aromatic: 1 },
      visibility: "private",
    },
  });
  assert.ok(portfolioPostId, "the review made a portfolio entry");

  // The stored record carries the private state, not only the in-memory set.
  assert.equal(findPublishedStallPost(portfolioPostId)?.visibility, "private");
  assert.ok(
    !listMockStallPosts().some((post) => post.id === portfolioPostId),
    "stall post listings leave it out",
  );

  const reloaded = reloadedService();
  assert.equal(await reloaded.social.getPostById(portfolioPostId), null);
  assert.ok(
    !(await reloaded.social.getBitesFeed()).some((bite) => bite.id === portfolioPostId),
    "the feed leaves it out",
  );
});

test("making an entry public again stores that with the post and getPostById returns it", async () => {
  const dish = dishes[0]!;
  const { portfolioPostId } = await hungryService.reviews.submitReview({
    dishId: dish.id,
    venueId: "venue-tian-tian",
    rating: 5,
    text: "Review that goes public again",
    tags: [],
    photos: ["https://example.test/public-again.jpg"],
    portfolio: {
      caption: "Public later",
      tasteStamp: { sweet: 1, spicy: 1, sour: 1, salty: 1, rich: 1, aromatic: 1 },
      visibility: "private",
    },
  });
  assert.ok(portfolioPostId);
  await hungryService.foodPortfolio.setEntryVisibility(portfolioPostId, "public");
  assert.equal(findPublishedStallPost(portfolioPostId)?.visibility, "public");

  const reloaded = reloadedService();
  assert.equal((await reloaded.social.getPostById(portfolioPostId))?.id, portfolioPostId);
});
