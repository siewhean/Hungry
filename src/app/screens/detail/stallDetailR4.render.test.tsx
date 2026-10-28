// Round-four stall page fixes (R4-STALL-*). Run with `npm run test:render`.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { StallDetailScreen } from "@/app/screens/detail/StallDetailScreen";
import {
  resetExperimentSession,
  setExperimentFlagSource,
} from "@/lib/experiments/experiments";
import {
  getDataRepository,
  getServiceProvider,
  setServiceProvider,
} from "@/lib/services/serviceProvider";
import type { HungryService } from "@/lib/services/types";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { cleanup, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

const STALL = "venue-tian-tian";

beforeEach(async () => {
  await enterScenario("user");
  useStallInteractionStore.getState()._reset();
});

afterEach(async () => {
  await cleanup();
  setExperimentFlagSource(undefined);
  resetExperimentSession();
});

const openStall = (venueId = STALL) =>
  renderScreen(StallDetailScreen as never, { name: "StallDetail", params: { venueId } });

/**
 * Switches to a "supabase" provider whose discovery reads come from `discovery`, and whose
 * repository throws on every stall/menu/building read (each one would start a full-table
 * download).
 */
function useLiveStallReads(discovery: Partial<HungryService["discovery"]>) {
  const base = getServiceProvider();
  const repositoryReads: string[] = [];
  const watched = new Set(["getVenueById", "listDishesByVenue", "listBuildings", "getDishById"]);
  const repository = new Proxy(base.repository, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function" || !watched.has(String(property))) return value;
      return () => {
        repositoryReads.push(String(property));
        throw new Error(`repository.${String(property)} must not be read on live data`);
      };
    },
  });
  const service = { ...base.service, discovery: { ...base.service.discovery, ...discovery } };
  setServiceProvider({ ...base, mode: "supabase", service, repository });
  return repositoryReads;
}

test("R4-STALL-25: on live data the stall page reads the stall and menu through the service only", async () => {
  const repo = getDataRepository();
  const venue = repo.getVenueById(STALL);
  const dishes = repo.listDishesByVenue(STALL);
  assert.ok(venue && dishes.length > 0, "mock stall has a menu");
  const calls: string[] = [];
  const repositoryReads = useLiveStallReads({
    getVenue: async () => {
      calls.push("getVenue");
      return { ...venue, latitude: 1.2804, longitude: 103.8446 };
    },
    listDishesByVenue: async () => {
      calls.push("listDishesByVenue");
      return dishes;
    },
    getVenueOpeningSchedule: async () => undefined,
    getPublicMerchantProfile: async () => undefined,
  });
  const view = await openStall();
  assert.match(view.text(), /Tian Tian Chicken Rice/);
  assert.ok(view.findByText(dishes[0].name), "the menu renders from the service read");
  assert.deepEqual(repositoryReads, [], "no synchronous repository read on live data");
  assert.ok(calls.includes("getVenue"));
  assert.ok(calls.includes("listDishesByVenue"));
});
