import assert from "node:assert/strict";
import test from "node:test";

import { getHomeSocialFeed } from "@/features/home/feed";
import { publishComposerPost } from "@/features/post/publishing";
import { useComposerStore } from "@/features/post/useComposerStore";
import { listSharedStallPosts } from "@/features/social/sharedStallPosts";
import { resetPublishedStallPostsForTest } from "@/lib/services/mock/stallPostState";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { guestProfile, userProfile } from "@/lib/services/mock/data";

test("composer publish writes a shared post visible in feed and profile sources", async () => {
  resetPublishedStallPostsForTest();
  usePublishedPostStore.getState().clearPostsForTest();
  useComposerStore.getState().reset();

  const service = getHungryService();
  const sessionA = await service.auth.signUp("author@example.sg", "password123", "Author A");
  assert.ok(sessionA);
  useProfileStore.setState({ profile: sessionA.profile });
  useComposerStore.setState({
    media: [
      {
        id: "test-media-1",
        uri: "https://example.com/author-a-post.jpg",
        type: "image",
      },
    ],
    postCaption: "A real shared post from the composer.",
    foodTags: ["Composer"],
    tasteTags: ["Aromatic"],
  });

  const published = await publishComposerPost({
    publishMode: "post",
    routeDishId: "dish-chicken-rice",
    routeVenueId: "venue-tian-tian",
  });

  assert.ok(published);
  assert.equal(published.authorId, sessionA.profile.id);
  assert.equal(published.authorName, "Author A");
  assert.equal(published.caption, "A real shared post from the composer.");
  assert.equal(published.publishedStatus, "published");
  assert.equal(published.visibility, "public");
  assert.deepEqual(published.dishIds, ["dish-chicken-rice"]);

  const sharedPosts = await listSharedStallPosts();
  assert.ok(sharedPosts.some((post) => post.id === published.id));

  const authorProfilePosts = sharedPosts.filter((post) => post.authorId === sessionA.profile.id);
  assert.ok(authorProfilePosts.some((post) => post.id === published.id));

  usePublishedPostStore.getState().clearPostsForTest();
  const serviceBackedPosts = await listSharedStallPosts();
  const serviceBackedPost = serviceBackedPosts.find((post) => post.id === published.id);
  assert.ok(serviceBackedPost);
  assert.equal(serviceBackedPost.authorId, sessionA.profile.id);
  assert.equal(serviceBackedPost.authorName, "Author A");

  const authorFeed = await getHomeSocialFeed(sessionA.profile);
  assert.ok(authorFeed.some((post) => post.id === published.id));
  assert.equal(authorFeed[0]?.id, published.id);

  const sessionB = await service.auth.signUp("reader@example.sg", "password123", "Reader B");
  assert.ok(sessionB);
  useProfileStore.setState({ profile: sessionB.profile });

  const readerFeed = await getHomeSocialFeed(sessionB.profile);
  const readerVisiblePost = readerFeed.find((post) => post.id === published.id);
  assert.ok(readerVisiblePost);
  assert.equal(readerFeed[0]?.id, published.id);
  assert.notEqual(readerVisiblePost.authorId, sessionB.profile.id);
  assert.equal(readerVisiblePost.authorName, "Author A");

  await service.auth.signOut();
  useProfileStore.setState({ profile: userProfile });
  useComposerStore.getState().reset();
  usePublishedPostStore.getState().clearPostsForTest();
  resetPublishedStallPostsForTest();
});

test("composer publish uses the authenticated profile when profile hydration is still guest", async () => {
  resetPublishedStallPostsForTest();
  usePublishedPostStore.getState().clearPostsForTest();
  useComposerStore.getState().reset();
  useSessionStore.setState({
    isAuthenticated: true,
    isAuthReady: true,
    hasCompletedOnboarding: true,
  });
  useProfileStore.setState({ profile: guestProfile });
  useComposerStore.setState({
    media: [
      {
        id: "test-media-authenticated-fallback",
        uri: "https://example.com/authenticated-fallback.jpg",
        type: "image",
      },
    ],
    postCaption: "Hydrated author fallback post.",
  });

  const published = await publishComposerPost({
    publishMode: "post",
    routeDishId: "dish-chicken-rice",
    routeVenueId: "venue-tian-tian",
  });

  assert.ok(published);
  assert.equal(published.authorId, getDataRepository().getProfile(true).id);
  assert.equal(published.authorName, getDataRepository().getProfile(true).displayName);
  assert.notEqual(published.authorId, guestProfile.id);

  useSessionStore.getState().clearSession();
  useProfileStore.setState({ profile: userProfile });
  useComposerStore.getState().reset();
  usePublishedPostStore.getState().clearPostsForTest();
  resetPublishedStallPostsForTest();
});
