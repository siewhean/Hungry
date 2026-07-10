import assert from "node:assert/strict";
import test from "node:test";

import { getHomeSocialFeed } from "./feed";
import { dataRepositoryMock } from "@/lib/services/mock/repositories";
import { resetServiceProvider, setServiceProvider } from "@/lib/services/serviceProvider";
import type { DataRepository, HungryService } from "@/lib/services/types";
import { userProfile } from "@/lib/services/mock/data";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";

test("Home social feed uses the active repository instead of hidden mock fallbacks", async () => {
  const mockPosts = dataRepositoryMock.listStallPosts();
  const partialRepository: DataRepository = {
    ...dataRepositoryMock,
    listStallPosts: () => mockPosts.slice(0, 3),
  };

  setServiceProvider({
    mode: "mock",
    repository: partialRepository,
    service: {} as HungryService,
    similarityScore: () => 1,
  });

  try {
    const feed = await getHomeSocialFeed(userProfile);
    assert.equal(feed.length, 3);
    assert.ok(!feed.some((post) => post.id === "post-8"));
  } finally {
    resetServiceProvider();
  }
});

test("Home social feed treats relative fixture timestamps as recent posts", async () => {
  usePublishedPostStore.getState().clearPostsForTest();
  setServiceProvider({
    mode: "mock",
    repository: dataRepositoryMock,
    service: {} as HungryService,
    similarityScore: () => 1,
  });

  try {
    const feed = await getHomeSocialFeed(userProfile);
    assert.equal(feed[0]?.id, "post-1");
  } finally {
    usePublishedPostStore.getState().clearPostsForTest();
    resetServiceProvider();
  }
});

test("Home social feed ranks followed authors before unfollowed authors", async () => {
  usePublishedPostStore.getState().clearPostsForTest();
  setServiceProvider({
    mode: "mock",
    repository: dataRepositoryMock,
    service: {} as HungryService,
    similarityScore: () => 1,
  });

  try {
    const feed = await getHomeSocialFeed(userProfile, {
      followedAuthors: {
        "Emma Watson": true,
        "Alicia Tan": true,
      },
    });
    const followedIds = new Set(["post-3", "post-8"]);
    const firstUnfollowedIndex = feed.findIndex((post) => !followedIds.has(post.id));
    const lastFollowedIndex = Math.max(
      ...feed.map((post, index) => (followedIds.has(post.id) ? index : -1)),
    );

    assert.equal(feed[0]?.id, "post-3");
    assert.equal(feed[1]?.id, "post-8");
    assert.ok(firstUnfollowedIndex > lastFollowedIndex);
  } finally {
    usePublishedPostStore.getState().clearPostsForTest();
    resetServiceProvider();
  }
});

test("Home social feed refresh seed changes order without duplicating posts", async () => {
  usePublishedPostStore.getState().clearPostsForTest();
  setServiceProvider({
    mode: "mock",
    repository: dataRepositoryMock,
    service: {} as HungryService,
    similarityScore: () => 1,
  });

  try {
    const initialFeed = await getHomeSocialFeed(userProfile, { refreshSeed: 0 });
    const refreshedFeed = await getHomeSocialFeed(userProfile, { refreshSeed: 1 });

    assert.notDeepEqual(
      refreshedFeed.map((post) => post.id),
      initialFeed.map((post) => post.id),
    );
    assert.deepEqual(
      [...new Set(refreshedFeed.map((post) => post.id))].sort(),
      initialFeed.map((post) => post.id).sort(),
    );
  } finally {
    usePublishedPostStore.getState().clearPostsForTest();
    resetServiceProvider();
  }
});

test("Home social feed refresh keeps followed posts above non-followed posts", async () => {
  usePublishedPostStore.getState().clearPostsForTest();
  setServiceProvider({
    mode: "mock",
    repository: dataRepositoryMock,
    service: {} as HungryService,
    similarityScore: () => 1,
  });

  try {
    const feed = await getHomeSocialFeed(userProfile, {
      followedAuthors: {
        "Emma Watson": true,
        "Alicia Tan": true,
      },
      refreshSeed: 1,
    });
    const followedIds = new Set(["post-3", "post-8"]);
    const firstUnfollowedIndex = feed.findIndex((post) => !followedIds.has(post.id));
    const lastFollowedIndex = Math.max(
      ...feed.map((post, index) => (followedIds.has(post.id) ? index : -1)),
    );

    assert.equal(feed[0]?.id, "post-8");
    assert.equal(feed[1]?.id, "post-3");
    assert.ok(firstUnfollowedIndex > lastFollowedIndex);
  } finally {
    usePublishedPostStore.getState().clearPostsForTest();
    resetServiceProvider();
  }
});
