import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { userProfile } from "@/lib/services/mock/data";
import { dataRepositoryMock } from "@/lib/services/mock/repositories";
import { resetServiceProvider, setServiceProvider } from "@/lib/services/serviceProvider";
import type { HungryService } from "@/lib/services/types";
import type { Portfolio, PortfolioItem } from "@/types/domain";
import { getPortfolioOwnerId, usePortfolioStore } from "./usePortfolioStore";
import { useProfileStore } from "./useProfileStore";
import { useSessionStore } from "./useSessionStore";

const AUTH_ID = "11111111-1111-4111-8111-111111111111";

function installPortfolioService(portfolio: Partial<HungryService["portfolio"]>) {
  setServiceProvider({
    mode: "supabase",
    repository: dataRepositoryMock,
    service: { portfolio } as unknown as HungryService,
    similarityScore: () => 1,
  });
}

afterEach(() => {
  usePortfolioStore.getState()._reset();
  resetServiceProvider();
});

test("SAVED-9: the mine scope asks for the auth user's lists even while the profile is the guest placeholder", async () => {
  useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: AUTH_ID });
  useProfileStore.setState({ profile: { ...userProfile, id: "guest-user" } });
  const asked: unknown[] = [];
  installPortfolioService({
    getPortfolios: async (filters) => {
      asked.push(filters);
      return [{ id: "p1", ownerId: AUTH_ID, name: "Hungry Picks" } as Portfolio];
    },
  });

  assert.equal(getPortfolioOwnerId(), AUTH_ID);
  await usePortfolioStore.getState().loadPortfolioScope("mine");
  assert.deepEqual(asked, [{ userId: AUTH_ID }]);
  assert.deepEqual(usePortfolioStore.getState().scopeIds.mine, ["p1"]);
});

test("SAVED-7: loadItemsForPortfolios fills every list from one service call", async () => {
  let calls = 0;
  installPortfolioService({
    getPortfolioItemsForPortfolios: async (ids) => {
      calls += 1;
      return Object.fromEntries(ids.map((id) => [id, [] as PortfolioItem[]]));
    },
  });
  await usePortfolioStore.getState().loadItemsForPortfolios(["a", "b", "c", "a"]);
  assert.equal(calls, 1);
  assert.deepEqual(Object.keys(usePortfolioStore.getState().items).sort(), ["a", "b", "c"]);
});

test("SAVED-10: after an item update the list's items are read back, so the screen shows what the server kept", async () => {
  const item = {
    id: "i1",
    portfolioId: "p1",
    itemType: "dish",
    dishId: "d1",
    score: 7,
  } as PortfolioItem;
  usePortfolioStore.setState({
    portfolios: [{ id: "p1", updatedAt: "2026-10-01T00:00:00Z" } as Portfolio],
    items: { p1: [item] },
  });
  let itemReads = 0;
  installPortfolioService({
    updatePortfolioItem: async () => undefined,
    getPortfolio: async () => ({ id: "p1", updatedAt: "2026-10-02T00:00:00Z" }) as Portfolio,
    getPortfolioItems: async () => {
      itemReads += 1;
      // The RPC keeps a score it was asked to drop.
      return [{ ...item, score: 7 }];
    },
  });
  await usePortfolioStore.getState().updateItem("i1", { score: undefined });
  assert.equal(itemReads, 1);
  assert.equal(usePortfolioStore.getState().items.p1[0].score, 7);
});
