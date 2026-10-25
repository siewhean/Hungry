import assert from "node:assert/strict";
import test from "node:test";

import { saveDishesAfterSignIn } from "@/features/auth/finishGuestAction";
import { userProfile } from "@/lib/services/mock/data";
import { dataRepositoryMock } from "@/lib/services/mock/repositories";
import { resetServiceProvider, setServiceProvider } from "@/lib/services/serviceProvider";
import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import type { HungryService } from "@/lib/services/types";
import type { DishDetail } from "@/types/domain";
import { useProfileStore } from "./useProfileStore";
import { useSessionStore } from "./useSessionStore";

// ONB-4 / ONB-V6: a guest's pending saves are written in one multi-row write, not one per dish.
const USER = "11111111-1111-4111-8111-111111111111";

function installService(options: { serverIds?: string[]; fail?: boolean } = {}) {
  const writes: { ids: string[]; expectedUserId?: string }[] = [];
  const singleWrites: string[] = [];
  setServiceProvider({
    mode: "supabase",
    repository: dataRepositoryMock,
    service: {
      profile: {
        getFavouriteDishIds: async () => options.serverIds ?? [],
        setFavourite: async (dishId: string) => {
          singleWrites.push(dishId);
          return true;
        },
        addFavourites: async (ids: string[], expectedUserId?: string) => {
          writes.push({ ids, expectedUserId });
          if (options.fail) throw new Error("offline");
        },
      },
      recommendations: { recordExplicitFeedback: async () => undefined },
    } as unknown as HungryService,
    similarityScore: () => 1,
  });
  setConfiguredDataSource("supabase");
  useSessionStore.setState({
    isAuthenticated: true,
    isAuthReady: true,
    authenticatedUserId: USER,
    authDataSource: "supabase",
  });
  useProfileStore.setState({
    profile: {
      ...userProfile,
      id: USER,
      favouriteDishIds: [],
      stats: { ...userProfile.stats, favouritesCount: 0 },
    },
  });
  return { writes, singleWrites };
}

const dishes = [
  { id: "dish-a", venueId: "venue-a", name: "A" },
  { id: "dish-b", venueId: "venue-b", name: "B" },
  { id: "dish-c", venueId: "venue-c", name: "C" },
] as DishDetail[];

test.afterEach(() => {
  resetServiceProvider();
  setConfiguredDataSource("mock");
  useSessionStore.setState({ isAuthenticated: false, authenticatedUserId: null });
});

test("pending guest saves go to the server in one write, skipping dishes the account has", async () => {
  const service = installService({ serverIds: ["dish-b"] });
  const failed = await saveDishesAfterSignIn(dishes);
  assert.deepEqual(failed, []);
  assert.deepEqual(service.writes, [{ ids: ["dish-a", "dish-c"], expectedUserId: USER }]);
  assert.deepEqual(service.singleWrites, []);
  assert.deepEqual(useProfileStore.getState().profile.favouriteDishIds, ["dish-a", "dish-c"]);
  assert.equal(useProfileStore.getState().profile.stats.favouritesCount, 2);
});

test("a failed batch write rolls the saves back and reports every dish as not saved", async () => {
  const service = installService({ fail: true });
  const failed = await saveDishesAfterSignIn(dishes.slice(0, 2));
  assert.equal(service.writes.length, 1);
  assert.deepEqual(
    failed.map((dish) => dish.id),
    ["dish-a", "dish-b"],
  );
  assert.deepEqual(useProfileStore.getState().profile.favouriteDishIds, []);
});
