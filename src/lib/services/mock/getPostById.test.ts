// A reload empties the mock's in-memory feed but not the posts it persisted. getPostById has to
// read those back, under the same public and not-blocked rules as a feed post.

import assert from "node:assert/strict";
import test from "node:test";

import { hungryService } from "@/lib/services/mock/mockService";
import { appendPublishedStallPost } from "@/lib/services/mock/stallPostState";
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
