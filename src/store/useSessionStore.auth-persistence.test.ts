import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import { setMockServiceProvider } from "@/lib/services/serviceProvider";
import { userProfile } from "@/lib/services/mock/data";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";

const SUPABASE_USER_ID = "11111111-1111-4111-8111-111111111111";
const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function resetAuthStores() {
  setConfiguredDataSource("mock");
  setMockServiceProvider();
  useProfileStore.setState({ profile: userProfile });
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

test("visible sign-out actions reset to login instead of onboarding", () => {
  const splashScreen = read("src/app/screens/SplashScreen.tsx");
  const settingsScreen = read("src/app/screens/profile/SettingsScreen.tsx");
  const profileHomeScreen = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  const merchantProfileScreen = read("src/app/screens/merchant/MerchantProfileScreen.tsx");

  assert.doesNotMatch(splashScreen, /!isAuthenticated[\s\S]*AuthStack/);
  assert.match(splashScreen, /name: "MainTabs"[\s\S]*params: \{ screen: "Home" \}/);

  [settingsScreen, profileHomeScreen, merchantProfileScreen].forEach((source) => {
    assert.match(source, /signOut\(\)/);
    assert.match(
      source,
      /rootNavigation\.reset\(\{\s*index: 0,[\s\S]*name: "AuthStack"[\s\S]*screen: "Login"/,
    );
    assert.doesNotMatch(source, /name: "OnboardingStack"/);
  });
});
