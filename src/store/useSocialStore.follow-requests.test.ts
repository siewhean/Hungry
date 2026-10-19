import assert from "node:assert/strict";
import test from "node:test";

import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import { getHungryService, setMockServiceProvider } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { useSocialStore } from "@/store/useSocialStore";

// Mock mode: "user-emma" is a private account, so following her is a pending request.
const PRIVATE_USER_ID = "user-emma";

function reset(isAuthenticated = true) {
  setConfiguredDataSource("mock");
  setMockServiceProvider();
  useSessionStore.setState({ isAuthenticated });
  useSocialStore.getState().clearAccountScopedState();
}

async function waitFor(check: () => boolean) {
  for (let attempt = 0; attempt < 100 && !check(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(check(), "timed out waiting for store state");
}

const requested = () => Boolean(useSocialStore.getState().requestedUserIds[PRIVATE_USER_ID]);
const followed = () => Boolean(useSocialStore.getState().followedUserIds[PRIVATE_USER_ID]);

test("Requested clears once the follow is approved, and unfollowing after that shows Follow", async () => {
  reset();
  useSocialStore.getState().toggleFollow(PRIVATE_USER_ID);
  await waitFor(requested);
  assert.equal(followed(), false);

  // The viewer's own Following list confirms the approval.
  useSocialStore.getState().markFollowedUserIds([PRIVATE_USER_ID]);
  assert.equal(followed(), true);
  assert.equal(requested(), false);

  // Unfollowing must not fall back to a stale "Requested".
  useSocialStore.getState().toggleFollow(PRIVATE_USER_ID);
  assert.equal(followed(), false);
  assert.equal(requested(), false);

  // A server reconcile to "following" also clears the request.
  useSocialStore.getState().setFollowRequested(PRIVATE_USER_ID, true);
  useSocialStore.getState().setFollowedUserId(PRIVATE_USER_ID, true);
  assert.equal(requested(), false);
});

test("reconcileRequestedFollows drops requests the server no longer has pending", async () => {
  reset();
  useSocialStore.getState().toggleFollow(PRIVATE_USER_ID);
  await waitFor(requested);

  // Still pending on the server: stays Requested.
  await useSocialStore.getState().reconcileRequestedFollows();
  assert.equal(requested(), true);

  // Declined (or cancelled elsewhere): the request is gone on the server.
  await getHungryService().social.cancelFollowRequest(PRIVATE_USER_ID);
  await useSocialStore.getState().reconcileRequestedFollows();
  assert.equal(requested(), false);
  assert.equal(followed(), false);
});

test("a guest cannot follow, like, save, comment or count a share", async () => {
  reset(false);
  const store = useSocialStore.getState();
  store.toggleFollow(PRIVATE_USER_ID);
  store.toggleLike("post-1");
  store.toggleSave("post-1");
  store.incrementShare("post-1");
  store.addComment("post-1", {
    id: "comment-guest",
    userId: "guest-user",
    authorName: "Guest",
    text: "hi",
    createdAt: new Date().toISOString(),
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const state = useSocialStore.getState();
  assert.equal(requested(), false);
  assert.equal(followed(), false);
  assert.equal(state.interactions["post-1"], undefined);
  assert.equal(state.commentsByPostId["post-1"], undefined);
  reset();
});
