import assert from "node:assert/strict";
import { test } from "node:test";
import { guestProfile, userProfile } from "@/lib/services/mock/data";
import { getHungryService, setMockServiceProvider } from "@/lib/services/serviceProvider";
import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { applySignedInProfile, captureGuestProfileSnapshot } from "./applySignedInProfile";
import { getMockLoginFailure, getMockSignUpFailure } from "./mockAuth";

test("primary mock email signup and login apply an authoritative demo identity before completing auth", async () => {
  setConfiguredDataSource("mock");
  setMockServiceProvider();
  await useSessionStore.persist.rehydrate();
  useSessionStore.getState().clearSession();
  useProfileStore.getState().applyProfile(structuredClone(guestProfile));
  const email = `primary-email-qa+${userProfile.email}`;
  const password = "password123";
  assert.equal(getMockSignUpFailure(email), null);
  const signup = await getHungryService().auth.signUp(email, password, userProfile.displayName);
  assert.ok(signup);
  assert.equal(
    await applySignedInProfile(signup.profile, {
      guestSnapshot: captureGuestProfileSnapshot(),
      profileReady: signup.profileReady,
    }),
    true,
  );
  useSessionStore.getState().completeAuth({
    userId: signup.profile.id,
    authProvider: "email",
    completedOnboarding: false,
    trackSignInEvent: false,
  });
  assert.notEqual(useProfileStore.getState().profile.id, guestProfile.id);
  assert.equal(useSessionStore.getState().authenticatedUserId, signup.profile.id);
  assert.equal(useProfileStore.getState().profile.email, email);
  await getHungryService().auth.signOut();
  useSessionStore.getState().clearSession();
  const guestSnapshot = captureGuestProfileSnapshot();
  assert.equal(getMockLoginFailure(email, password), null);
  const login = await getHungryService().auth.signIn(email, password);
  assert.equal(
    await applySignedInProfile(login.profile, { guestSnapshot, profileReady: login.profileReady }),
    true,
  );
  useSessionStore.getState().completeAuth({
    userId: login.profile.id,
    authProvider: "email",
    completedOnboarding: true,
    trackSignInEvent: false,
  });
  assert.equal(useSessionStore.getState().authenticatedUserId, signup.profile.id);
  assert.equal(useProfileStore.getState().profile.id, signup.profile.id);
  assert.equal(useProfileStore.getState().profile.email, email);
  assert.equal(useSessionStore.getState().isAuthenticated, true);
});
