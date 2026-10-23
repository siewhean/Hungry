import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import { getHungryService, setMockServiceProvider } from "@/lib/services/serviceProvider";
import { userProfile } from "@/lib/services/mock/data";
import type { ActivityUpdate } from "@/features/home/activity";
import type { StallPost } from "@/types/domain";
import { useActivityStore } from "@/store/useActivityStore";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useSocialStore } from "@/store/useSocialStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";

const SUPABASE_USER_ID = "11111111-1111-4111-8111-111111111111";
const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function resetAuthStores() {
  setConfiguredDataSource("mock");
  setMockServiceProvider();
  useProfileStore.setState({ profile: userProfile });
  useSocialStore.getState().clearAccountScopedState();
  useActivityStore.getState().clearAccountScopedState();
  usePublishedPostStore.getState().clearPosts();
  useStallInteractionStore.getState()._reset();
  useSessionStore.setState({
    hasHydrated: true,
    isAuthReady: true,
    isAuthenticated: false,
    hasCompletedOnboarding: false,
    hasSkippedTasteQuiz: false,
    authenticatedUserId: null,
    authDataSource: null,
    returnRoute: undefined,
    sessionExpired: false,
    signOutPending: false,
  });
}

test.beforeEach(resetAuthStores);
test.afterEach(resetAuthStores);

test("session store persists app auth state through the durable app storage adapter", () => {
  const source = read("src/store/useSessionStore.ts");

  assert.match(source, /import \{ hungryPersistStorage \} from "\.\/persistStorage"/);
  assert.match(source, /storage: hungryPersistStorage/);
  assert.doesNotMatch(source, /hungrySecurePersistStorage/);
  assert.match(
    source,
    /Supabase refresh\/access tokens stay\s*\/\/ in the dedicated SecureStore-backed auth adapter/,
  );
});

test("durable app storage migrates legacy SecureStore session metadata", () => {
  const source = read("src/store/persistStorage.ts");

  assert.match(source, /type SecureStoreLike = \{/);
  assert.match(source, /getLegacySecureStore\(\)/);
  assert.match(source, /legacySecureStore\.getItemAsync\(name\)/);
  assert.match(source, /await asyncStorage\.setItem\(name, legacyValue\)/);
  assert.match(source, /await legacySecureStore\.deleteItemAsync\(name\)/);
  assert.match(
    source,
    /App metadata previously used SecureStore[\s\S]*existing[\s\S]*signed-in installs/,
  );
});

test("a guest who finished onboarding locally is not sent through onboarding after sign-in", () => {
  useSessionStore.setState({ hasCompletedOnboarding: true });

  useSessionStore.getState().completeAuth({
    completedOnboarding: false,
    trackSignInEvent: false,
  });
  assert.equal(useSessionStore.getState().hasCompletedOnboarding, true);

  useSessionStore.getState().applyAuthStateFromSession({
    isAuthenticated: true,
    userId: "guest-signin-user",
    completedOnboarding: false,
  });
  assert.equal(useSessionStore.getState().hasCompletedOnboarding, true);
});

test("completeAuth records the Supabase user and data source for reload restoration", () => {
  setConfiguredDataSource("supabase");
  useProfileStore.setState({
    profile: {
      ...userProfile,
      id: SUPABASE_USER_ID,
      email: "auth-persistence@example.test",
      displayName: "Auth Persistence",
    },
  });

  useSessionStore.getState().completeAuth({
    completedOnboarding: true,
    skippedTasteQuiz: true,
    trackSignInEvent: false,
  });

  const state = useSessionStore.getState();
  assert.equal(state.isAuthenticated, true);
  assert.equal(state.isAuthReady, true);
  assert.equal(state.authenticatedUserId, SUPABASE_USER_ID);
  assert.equal(state.authDataSource, "supabase");
  assert.equal(state.hasCompletedOnboarding, true);
  assert.equal(state.hasSkippedTasteQuiz, true);
});

test("invalid Supabase auth restoration is rejected instead of persisting a mock id", () => {
  setConfiguredDataSource("supabase");
  useSessionStore.setState({
    isAuthenticated: true,
    isAuthReady: true,
    authenticatedUserId: SUPABASE_USER_ID,
    authDataSource: "supabase",
  });

  useSessionStore.getState().applyAuthStateFromSession({
    isAuthenticated: true,
    userId: "mock-user",
  });

  const state = useSessionStore.getState();
  assert.equal(state.isAuthenticated, false);
  assert.equal(state.authenticatedUserId, null);
  assert.equal(state.authDataSource, null);
  assert.equal(state.isAuthReady, true);
});

test("Supabase auth restoration preserves a service-hydrated profile with the same user id", () => {
  setConfiguredDataSource("supabase");
  useProfileStore.setState({
    profile: {
      ...userProfile,
      id: SUPABASE_USER_ID,
      email: "mvp-profile@example.test",
      displayName: "MVP Profile",
      avatarUrl: "https://example.test/avatar.png",
      dietaryPreferences: ["halal"],
      profileVisibility: "private",
    },
  });

  useSessionStore.getState().applyAuthStateFromSession({
    isAuthenticated: true,
    userId: SUPABASE_USER_ID,
  });

  const profile = useProfileStore.getState().profile;
  assert.equal(profile.id, SUPABASE_USER_ID);
  assert.equal(profile.displayName, "MVP Profile");
  assert.equal(profile.avatarUrl, "https://example.test/avatar.png");
  assert.deepEqual(profile.dietaryPreferences, ["halal"]);
  assert.equal(profile.profileVisibility, "private");
});

test("explicit auth sign-out clears the restored app session", () => {
  setConfiguredDataSource("supabase");
  useSessionStore.setState({
    isAuthenticated: true,
    isAuthReady: true,
    authenticatedUserId: SUPABASE_USER_ID,
    authDataSource: "supabase",
    hasCompletedOnboarding: true,
    hasSkippedTasteQuiz: true,
  });

  useSessionStore.getState().applyAuthStateFromSession({
    isAuthenticated: false,
    userId: null,
  });

  const state = useSessionStore.getState();
  assert.equal(state.isAuthenticated, false);
  assert.equal(state.authenticatedUserId, null);
  assert.equal(state.authDataSource, null);
  assert.equal(state.isAuthReady, true);
});

test("manual signOut clears auth state but keeps returning users on login", () => {
  useSessionStore.setState({
    isAuthenticated: true,
    isAuthReady: true,
    authenticatedUserId: "mock-user",
    authDataSource: "mock",
    hasCompletedOnboarding: true,
    hasSkippedTasteQuiz: true,
  });

  useSessionStore.getState().signOut();

  const state = useSessionStore.getState();
  assert.equal(state.isAuthenticated, false);
  assert.equal(state.authenticatedUserId, null);
  assert.equal(state.authDataSource, null);
  assert.equal(state.isAuthReady, true);
  assert.equal(state.hasCompletedOnboarding, true);
  assert.equal(state.hasSkippedTasteQuiz, true);
});

test("manual signOut clears account-scoped optimistic caches", () => {
  useSocialStore.setState({
    interactions: {
      "post-1": {
        liked: true,
        saved: true,
        savedAt: "2026-06-05T00:00:00.000Z",
        likeCount: 1,
        saveCount: 1,
        shareCount: 0,
        commentCount: 0,
      },
    },
    followedAuthors: { "Hungry User": true },
    followedUserIds: { [SUPABASE_USER_ID]: true },
    commentsByPostId: {
      "post-1": [
        {
          id: "comment-1",
          authorName: "MVP Profile",
          text: "Nice",
          createdAt: "2026-06-05T00:00:00.000Z",
        },
      ],
    },
    repliesByCommentId: {},
  });
  useActivityStore.setState({
    readActivityIds: ["update:activity-1"],
    activityUpdates: [
      {
        id: "activity-1",
        kind: "like",
        postId: "post-1",
        actorName: "Someone",
        text: "liked your post",
        target: "post-1",
        time: "now",
        unread: true,
      } satisfies ActivityUpdate,
    ],
    sharedPostMessages: {},
    dbActivityEvents: [],
  });
  usePublishedPostStore.setState({
    posts: [
      {
        id: "post-1",
        venueId: "venue-1",
        buildingId: "building-1",
        mediaType: "photo",
        mediaUrl: "https://example.test/post.jpg",
        caption: "Cached post",
        dishIds: [],
        authorName: "MVP Profile",
        authorAvatarUrl: "https://example.test/avatar.jpg",
        authorLocation: "Singapore",
        createdAt: "2026-06-05T00:00:00.000Z",
      } as StallPost,
    ],
  });
  useStallInteractionStore.setState({
    isLoaded: true,
    interactions: {
      "stall-1": {
        userId: SUPABASE_USER_ID,
        stallId: "stall-1",
        isSaved: true,
        isTried: false,
        isReviewed: false,
      },
    },
  });
  useSessionStore.setState({
    isAuthenticated: true,
    isAuthReady: true,
    authenticatedUserId: SUPABASE_USER_ID,
    authDataSource: "supabase",
    hasCompletedOnboarding: true,
  });

  useSessionStore.getState().signOut();

  assert.deepEqual(useSocialStore.getState().interactions, {});
  assert.deepEqual(useSocialStore.getState().followedUserIds, {});
  assert.deepEqual(useActivityStore.getState().activityUpdates, []);
  assert.deepEqual(useActivityStore.getState().readActivityIds, []);
  assert.deepEqual(usePublishedPostStore.getState().posts, []);
  assert.deepEqual(useStallInteractionStore.getState().interactions, {});
});

test("visible sign-out actions reset to login instead of onboarding", () => {
  const splashScreen = read("src/app/screens/SplashScreen.tsx");
  const settingsScreen = read("src/app/screens/profile/SettingsScreen.tsx");
  const profileHomeScreen = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  const merchantProfileScreen = read("src/app/screens/merchant/MerchantProfileScreen.tsx");

  // Mandatory sign-in: signed-out cold starts open Login, never MainTabs.
  assert.match(
    splashScreen,
    /if \(!isAuthenticated\) \{[\s\S]*name: "AuthStack"[\s\S]*screen: "Login"/,
  );

  [settingsScreen, profileHomeScreen, merchantProfileScreen].forEach((source) => {
    assert.match(source, /signOut\(\)/);
    assert.match(
      source,
      /rootNavigation\.reset\(\{\s*index: 0,[\s\S]*name: "AuthStack"[\s\S]*screen: "Login"/,
    );
    assert.doesNotMatch(source, /name: "OnboardingStack"/);
  });
});

test("a Supabase sign-out that does not finish is remembered and finished on next launch", async () => {
  setConfiguredDataSource("supabase");
  const auth = getHungryService().auth;
  const originalSignOut = auth.signOut;
  let signOutCalls = 0;
  auth.signOut = () => {
    signOutCalls += 1;
    return Promise.reject(new Error("offline"));
  };
  try {
    useSessionStore.setState({
      isAuthenticated: true,
      authenticatedUserId: SUPABASE_USER_ID,
      authDataSource: "supabase",
    });
    useSessionStore.getState().signOut();
    assert.equal(useSessionStore.getState().isAuthenticated, false);
    assert.equal(useSessionStore.getState().signOutPending, true);

    // Next launch: bootstrap finishes the sign-out before restoring a stored session.
    auth.signOut = () => {
      signOutCalls += 1;
      return Promise.resolve();
    };
    await useSessionStore.getState().finishPendingSignOut();
    assert.equal(useSessionStore.getState().signOutPending, false);
    assert.ok(signOutCalls >= 2);
  } finally {
    auth.signOut = originalSignOut;
  }
});

test("sign-out clears the stored Supabase session before any restore", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(
    service,
    /async signOut\(options\) \{[\s\S]*?if \(!error\) return;[\s\S]*?const \{ error: localError \} = await client\.auth\.signOut\(\{ scope: "local" \}\);/,
  );
  const store = read("src/store/useSessionStore.ts");
  assert.match(store, /signOutPending: state\.signOutPending/);
  const bootstrap = read("src/hooks/useAppBootstrap.ts");
  assert.match(
    bootstrap,
    /\.finishPendingSignOut\(\)\s*\.then\(\(\) => getSessionWithTimeout\(client\)\)/,
  );
});
