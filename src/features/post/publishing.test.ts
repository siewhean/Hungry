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
    showFoodContextOverlay: false,
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
  assert.equal(published.showFoodContextOverlay, false);

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
  assert.equal(serviceBackedPost.showFoodContextOverlay, false);

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

test("review-only composer publish validates rating and records review state without creating a post", async () => {
  resetPublishedStallPostsForTest();
  usePublishedPostStore.getState().clearPostsForTest();
  useComposerStore.getState().reset();

  const service = getHungryService();
  const session = await service.auth.signUp(
    "review-only-author@example.sg",
    "password123",
    "Review Author",
  );
  assert.ok(session);
  useSessionStore.setState({
    isAuthenticated: true,
    isAuthReady: true,
    hasCompletedOnboarding: true,
  });
  useProfileStore.setState({ profile: session.profile });
  useComposerStore.setState({
    reviewCaption: "A proper review from the composer.",
    foodTags: ["Classic"],
    tasteTags: ["Savoury"],
  });

  await assert.rejects(
    () =>
      publishComposerPost({
        publishMode: "review",
        routeDishId: "dish-chicken-rice",
        routeVenueId: "venue-tian-tian",
      }),
    /Add a rating before publishing a review\./,
  );

  useComposerStore.setState({ rating: 4 });
  const published = await publishComposerPost({
    publishMode: "review",
    routeDishId: "dish-chicken-rice",
    routeVenueId: "venue-tian-tian",
  });

  assert.equal(published, undefined);
  assert.equal(usePublishedPostStore.getState().posts.length, 0);
  const profileState = useProfileStore.getState();
  assert.ok(profileState.profile.reviewedDishIds.includes("dish-chicken-rice"));
  assert.equal(profileState.reviewEntries["dish-chicken-rice"]?.rating, 4);
  assert.equal(
    profileState.reviewEntries["dish-chicken-rice"]?.text,
    "A proper review from the composer.",
  );

  await service.auth.signOut();
  useSessionStore.getState().clearSession();
  useProfileStore.setState({ profile: userProfile });
  useComposerStore.getState().reset();
  usePublishedPostStore.getState().clearPostsForTest();
  resetPublishedStallPostsForTest();
});

test("publish-both records a review and still publishes a cross-user home feed post", async () => {
  resetPublishedStallPostsForTest();
  usePublishedPostStore.getState().clearPostsForTest();
  useComposerStore.getState().reset();

  const service = getHungryService();
  const sessionA = await service.auth.signUp(
    "publish-both-author@example.sg",
    "password123",
    "Publish Both Author",
  );
  assert.ok(sessionA);
  useSessionStore.setState({
    isAuthenticated: true,
    isAuthReady: true,
    hasCompletedOnboarding: true,
  });
  useProfileStore.setState({ profile: sessionA.profile });
  useComposerStore.setState({
    media: [
      {
        id: "publish-both-media",
        uri: "https://example.com/publish-both.jpg",
        type: "image",
      },
    ],
    postCaption: "Public post from publish both.",
    reviewCaption: "Review text from publish both.",
    rating: 5,
    foodTags: ["Rice"],
    tasteTags: ["Aromatic"],
  });

  const published = await publishComposerPost({
    publishMode: "both",
    routeDishId: "dish-chicken-rice",
    routeVenueId: "venue-tian-tian",
  });

  assert.ok(published);
  assert.equal(published.caption, "Public post from publish both.");
  assert.equal(published.authorId, sessionA.profile.id);
  assert.ok(useProfileStore.getState().profile.reviewedDishIds.includes("dish-chicken-rice"));

  const sessionB = await service.auth.signUp(
    "publish-both-reader@example.sg",
    "password123",
    "Publish Both Reader",
  );
  assert.ok(sessionB);
  useProfileStore.setState({ profile: sessionB.profile });

  const readerFeed = await getHomeSocialFeed(sessionB.profile);
  assert.ok(readerFeed.some((post) => post.id === published.id));

  await service.auth.signOut();
  useSessionStore.getState().clearSession();
  useProfileStore.setState({ profile: userProfile });
  useComposerStore.getState().reset();
  usePublishedPostStore.getState().clearPostsForTest();
  resetPublishedStallPostsForTest();
});

test("publish-both validates post media before writing review state", async () => {
  resetPublishedStallPostsForTest();
  usePublishedPostStore.getState().clearPostsForTest();
  useComposerStore.getState().reset();

  const service = getHungryService();
  const session = await service.auth.signUp(
    "publish-both-missing-media@example.sg",
    "password123",
    "Missing Media Author",
  );
  assert.ok(session);
  useSessionStore.setState({
    isAuthenticated: true,
    isAuthReady: true,
    hasCompletedOnboarding: true,
  });
  useProfileStore.setState({ profile: session.profile });
  useComposerStore.setState({
    postCaption: "This should not partially publish.",
    reviewCaption: "This review should not be saved before post media validation.",
    rating: 4,
  });

  await assert.rejects(
    () =>
      publishComposerPost({
        publishMode: "both",
        routeDishId: "dish-chicken-rice",
        routeVenueId: "venue-tian-tian",
      }),
    /Add a photo or video before publishing\./,
  );

  const profileState = useProfileStore.getState();
  assert.equal(usePublishedPostStore.getState().posts.length, 0);
  assert.equal(profileState.profile.reviewedDishIds.includes("dish-chicken-rice"), false);
  assert.equal(profileState.reviewEntries["dish-chicken-rice"], undefined);

  await service.auth.signOut();
  useSessionStore.getState().clearSession();
  useProfileStore.setState({ profile: userProfile });
  useComposerStore.getState().reset();
  usePublishedPostStore.getState().clearPostsForTest();
  resetPublishedStallPostsForTest();
});

test("publish-both keeps local review state unchanged when post write fails", async () => {
  resetPublishedStallPostsForTest();
  usePublishedPostStore.getState().clearPostsForTest();
  useComposerStore.getState().reset();

  const service = getHungryService();
  const originalPostBite = service.social.postBite;
  const session = await service.auth.signUp(
    "publish-both-post-failure@example.sg",
    "password123",
    "Post Failure Author",
  );
  assert.ok(session);
  useSessionStore.setState({
    isAuthenticated: true,
    isAuthReady: true,
    hasCompletedOnboarding: true,
  });
  useProfileStore.setState({ profile: session.profile });
  useComposerStore.setState({
    media: [
      {
        id: "publish-both-post-failure-media",
        uri: "https://example.com/publish-both-post-failure.jpg",
        type: "image",
      },
    ],
    postCaption: "This post write will fail.",
    reviewCaption: "This local review state should not commit.",
    rating: 4,
  });

  service.social.postBite = async () => {
    throw new Error("Simulated post write failure.");
  };

  try {
    await assert.rejects(
      () =>
        publishComposerPost({
          publishMode: "both",
          routeDishId: "dish-chicken-rice",
          routeVenueId: "venue-tian-tian",
        }),
      /Simulated post write failure\./,
    );

    const profileState = useProfileStore.getState();
    assert.equal(usePublishedPostStore.getState().posts.length, 0);
    assert.equal(profileState.profile.reviewedDishIds.includes("dish-chicken-rice"), false);
    assert.equal(profileState.reviewEntries["dish-chicken-rice"], undefined);
  } finally {
    service.social.postBite = originalPostBite;
    await service.auth.signOut();
    useSessionStore.getState().clearSession();
    useProfileStore.setState({ profile: userProfile });
    useComposerStore.getState().reset();
    usePublishedPostStore.getState().clearPostsForTest();
    resetPublishedStallPostsForTest();
  }
});
