import assert from "node:assert/strict";
import test from "node:test";

import { dishes, userProfile } from "@/lib/services/mock/data";
import { dataRepositoryMock } from "@/lib/services/mock/repositories";
import { resetServiceProvider, setServiceProvider } from "@/lib/services/serviceProvider";
import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import type { HungryService } from "@/lib/services/types";
import { useProfileStore } from "./useProfileStore";
import { useSessionStore } from "./useSessionStore";
import { useUIStore } from "./useUIStore";

const SUPABASE_USER_ID = "11111111-1111-4111-8111-111111111111";

function installSupabaseFavouriteService(getFavouriteDishIds: () => Promise<string[]>) {
  setServiceProvider({
    mode: "supabase",
    repository: dataRepositoryMock,
    service: {
      profile: {
        getFavouriteDishIds,
      },
    } as unknown as HungryService,
    similarityScore: () => 1,
  });
  setConfiguredDataSource("supabase");
}

function setAuthenticatedProfile(favouriteDishIds: string[]) {
  useSessionStore.setState({
    isAuthenticated: true,
    isAuthReady: true,
    authenticatedUserId: SUPABASE_USER_ID,
    authDataSource: "supabase",
  });
  useProfileStore.setState({
    profile: {
      ...userProfile,
      id: SUPABASE_USER_ID,
      favouriteDishIds,
      stats: {
        ...userProfile.stats,
        favouritesCount: favouriteDishIds.length,
      },
    },
  });
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

test("syncProfile rehydrates favourite dish IDs for an already loaded Supabase profile", async () => {
  let calls = 0;
  const remoteFavouriteDishIds = ["dish-remote-laksa", "dish-remote-ban-mian"];
  installSupabaseFavouriteService(async () => {
    calls += 1;
    return remoteFavouriteDishIds;
  });
  setAuthenticatedProfile([]);

  useProfileStore.getState().syncProfile(true, SUPABASE_USER_ID);

  assert.equal(calls, 1);
  await Promise.resolve();
  await Promise.resolve();

  const profile = useProfileStore.getState().profile;
  assert.deepEqual(profile.favouriteDishIds, remoteFavouriteDishIds);
  assert.equal(profile.stats.favouritesCount, remoteFavouriteDishIds.length);
});

test("syncProfile keeps the current profile when favourite rehydration fails", async () => {
  const localFavouriteDishIds = ["dish-local-chicken-rice"];
  const originalWarn = console.warn;
  console.warn = () => undefined;
  installSupabaseFavouriteService(async () => {
    throw new Error("favourites unavailable");
  });
  setAuthenticatedProfile(localFavouriteDishIds);

  try {
    useProfileStore.getState().syncProfile(true, SUPABASE_USER_ID);
    await Promise.resolve();
    await Promise.resolve();

    const profile = useProfileStore.getState().profile;
    assert.deepEqual(profile.favouriteDishIds, localFavouriteDishIds);
    assert.equal(profile.stats.favouritesCount, localFavouriteDishIds.length);
    assert.equal(useProfileStore.getState().favouritesRehydrationFailed, true);
  } finally {
    console.warn = originalWarn;
  }
});

test("syncProfile clears the rehydration error flag after a successful load", async () => {
  installSupabaseFavouriteService(async () => ["dish-remote-laksa"]);
  setAuthenticatedProfile([]);
  useProfileStore.setState({ favouritesRehydrationFailed: true });

  useProfileStore.getState().syncProfile(true, SUPABASE_USER_ID);
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(useProfileStore.getState().favouritesRehydrationFailed, false);
});

test("toggleFavourite rolls back and returns a failed result when sync fails", async () => {
  const originalError = console.error;
  console.error = () => undefined;
  setServiceProvider({
    mode: "supabase",
    repository: dataRepositoryMock,
    service: {
      profile: {
        toggleFavourite: async () => {
          throw new Error("favourite write failed");
        },
      },
      recommendations: {
        recordExplicitFeedback: async () => undefined,
      },
    } as unknown as HungryService,
    similarityScore: () => 1,
  });
  setConfiguredDataSource("supabase");
  setAuthenticatedProfile([]);
  useUIStore.setState({ toast: null });
  const dish = dishes[0];

  try {
    const pending = useProfileStore.getState().toggleFavourite(dish);
    assert.deepEqual(useProfileStore.getState().profile.favouriteDishIds, [dish.id]);
    const result = await pending;

    assert.deepEqual(useProfileStore.getState().profile.favouriteDishIds, []);
    // Callers surface the failure (toast) from the result; the store never guesses.
    assert.equal(result.status, "failed");
  } finally {
    console.error = originalError;
  }
});
