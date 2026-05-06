import assert from "node:assert/strict";
import test from "node:test";

import { getHomeSocialFeed } from "./feed";
import { dataRepositoryMock } from "@/lib/services/mock/repositories";
import { resetServiceProvider, setServiceProvider } from "@/lib/services/serviceProvider";
import type { DataRepository, HungryService } from "@/lib/services/types";
import { userProfile } from "@/lib/services/mock/data";

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
