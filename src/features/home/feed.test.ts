import assert from "node:assert/strict";
import test from "node:test";

import { getHomeSocialFeed } from "./feed";
import { dataRepositoryMock } from "@/lib/services/mock/repositories";
import { resetServiceProvider, setServiceProvider } from "@/lib/services/serviceProvider";
import type { DataRepository, HungryService } from "@/lib/services/types";
import { userProfile } from "@/lib/services/mock/data";

test("Home social feed appends fallback mock posts when active repository only has seeded posts", () => {
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
    const feed = getHomeSocialFeed(userProfile);
    assert.ok(feed.length >= mockPosts.length);
    assert.ok(feed.some((post) => post.id === "post-8"));
  } finally {
    resetServiceProvider();
  }
});
