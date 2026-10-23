import assert from "node:assert/strict";
import test from "node:test";

import { userProfile } from "@/lib/services/mock/data";
import { dataRepositoryMock } from "@/lib/services/mock/repositories";
import { resetServiceProvider, setServiceProvider } from "@/lib/services/serviceProvider";
import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import type { HungryService } from "@/lib/services/types";
import { useProfileStore } from "./useProfileStore";
import { useSessionStore } from "./useSessionStore";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

interface Deferred {
  resolve: (saved: boolean) => void;
  reject: (error: unknown) => void;
}

function installDeferredFavouriteService(calls: { dishId: string; expectedUserId?: string }[]) {
  const pending: Deferred[] = [];
  setServiceProvider({
    mode: "supabase",
    repository: dataRepositoryMock,
    service: {
      profile: {
        getFavouriteDishIds: async () => [],
        toggleFavourite: (dishId: string, expectedUserId?: string) => {
          calls.push({ dishId, expectedUserId });
          return new Promise<boolean>((resolve, reject) => pending.push({ resolve, reject }));
        },
      },
    } as unknown as HungryService,
    similarityScore: () => 1,
  });
  setConfiguredDataSource("supabase");
  return pending;
}

function signInAs(userId: string, favouriteDishIds: string[]) {
  useSessionStore.setState({
    isAuthenticated: true,
    isAuthReady: true,
    authenticatedUserId: userId,
    authDataSource: "supabase",
  });
  useProfileStore.setState({
    profile: {
      ...userProfile,
      id: userId,
      favouriteDishIds,
      stats: { ...userProfile.stats, favouritesCount: favouriteDishIds.length },
    },
  });
}

function switchToUser(userId: string, favouriteDishIds: string[]) {
  // Mirrors sign-out / account switch: the profile store is cleared before the new account loads.
  useProfileStore.getState().clearProfile();
  signInAs(userId, favouriteDishIds);
}

test.afterEach(() => {
  resetServiceProvider();
  setConfiguredDataSource("mock");
  useSessionStore.setState({
    isAuthenticated: false,
    authenticatedUserId: null,
    authDataSource: null,
  });
});

test("toggleFavourite pins the write to the initiating user id", async () => {
  const calls: { dishId: string; expectedUserId?: string }[] = [];
  const pending = installDeferredFavouriteService(calls);
  signInAs(USER_A, []);

  const result = useProfileStore.getState().toggleFavourite({ id: "dish-a", venueId: "venue-a" });
  pending[0].resolve(true);

  assert.deepEqual(await result, { status: "saved" });
  assert.deepEqual(calls, [{ dishId: "dish-a", expectedUserId: USER_A }]);
  assert.deepEqual(useProfileStore.getState().profile.favouriteDishIds, ["dish-a"]);
});

test("a favourite save resolving after an account switch does not touch the new user", async () => {
  const pending = installDeferredFavouriteService([]);
  signInAs(USER_A, []);

  const result = useProfileStore.getState().toggleFavourite({ id: "dish-a", venueId: "venue-a" });
  switchToUser(USER_B, ["dish-b"]);
  const userBProfile = useProfileStore.getState().profile;
  pending[0].resolve(true);

  const outcome = await result;
  assert.equal(outcome.status, "failed");
  assert.equal(outcome.status === "failed" && outcome.reason, "stale");
  assert.equal(useProfileStore.getState().profile, userBProfile);
  assert.deepEqual(useProfileStore.getState().profile.favouriteDishIds, ["dish-b"]);
});

test("a favourite failure arriving after an account switch does not roll back the new user", async () => {
  const pending = installDeferredFavouriteService([]);
  signInAs(USER_A, ["dish-a"]);

  const result = useProfileStore.getState().toggleFavourite({ id: "dish-a", venueId: "venue-a" });
  switchToUser(USER_B, ["dish-b"]);
  const userBProfile = useProfileStore.getState().profile;
  pending[0].reject(new Error("network"));

  const outcome = await result;
  assert.equal(outcome.status === "failed" && outcome.reason, "stale");
  assert.equal(useProfileStore.getState().profile, userBProfile);
  assert.deepEqual(useProfileStore.getState().profile.favouriteDishIds, ["dish-b"]);
});

test("a favourite save resolving after sign-out is discarded", async () => {
  const pending = installDeferredFavouriteService([]);
  signInAs(USER_A, []);

  const result = useProfileStore.getState().toggleFavourite({ id: "dish-a", venueId: "venue-a" });
  useProfileStore.getState().clearProfile();
  useSessionStore.setState({ isAuthenticated: false, authenticatedUserId: null });
  const signedOutProfile = useProfileStore.getState().profile;
  pending[0].resolve(true);

  const outcome = await result;
  assert.equal(outcome.status === "failed" && outcome.reason, "stale");
  assert.equal(useProfileStore.getState().profile, signedOutProfile);
});
