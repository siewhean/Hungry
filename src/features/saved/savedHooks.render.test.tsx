// Behaviour of the Saved page's data hooks (useSavedStalls, useSavedSearch, useListCovers):
// batching, debounce, and what each does when a read fails. Run with
// `node scripts/test-render.mjs src/features/saved/savedHooks.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";
import { Text } from "react-native";

import { getHungryService } from "@/lib/services/serviceProvider";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { cleanup, render } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type {
  Portfolio,
  PortfolioItem,
  Review,
  StallInteraction,
  VenueSummary,
} from "@/types/domain";
import { useListCovers } from "./useListCovers";
import { SAVED_SEARCH_DEBOUNCE_MS, useSavedSearch } from "./useSavedSearch";
import { useProfileStore } from "@/store/useProfileStore";
import { useSavedStalls, useVisitedStalls } from "./useSavedStalls";

const restores: (() => void)[] = [];
function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(async () => {
  await enterScenario("user");
});
afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()?.();
});

function stallInteractions(count: number) {
  const interactions: Record<string, StallInteraction> = {};
  for (let index = 0; index < count; index += 1) {
    interactions[`s${index}`] = {
      userId: "user",
      stallId: `s${index}`,
      isSaved: true,
      isTried: false,
      isReviewed: false,
      savedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, count - index)).toISOString(),
    };
  }
  useStallInteractionStore.setState({ interactions, isLoaded: true });
}

test("useVisitedStalls lists tried stalls newest first from the server, even ones the cache lacks", async () => {
  const profile = useProfileStore.getState().profile;
  useProfileStore.setState({ profile: { ...profile, reviewedDishIds: [] } });
  const interactions: Record<string, StallInteraction> = {};
  for (const [id, triedAt] of [
    ["old", "2026-01-01T00:00:00.000Z"],
    ["new", "2026-03-01T00:00:00.000Z"],
  ] as const) {
    interactions[id] = {
      userId: "user",
      stallId: id,
      isSaved: false,
      isTried: true,
      isReviewed: false,
      triedAt,
    };
  }
  interactions.savedOnly = {
    userId: "user",
    stallId: "savedOnly",
    isSaved: true,
    isTried: false,
    isReviewed: false,
  };
  useStallInteractionStore.setState({ interactions, isLoaded: true });
  const asked: string[][] = [];
  stub(getHungryService().discovery, "getVenuesByIds", async (ids: string[]) => {
    asked.push(ids);
    return ids.map((id) => ({ id, name: `Stall ${id}` }) as VenueSummary);
  });
  const Probe = ({ enabled }: { enabled: boolean }) => {
    const state = useVisitedStalls(enabled);
    return createElement(Text, null, `${state.status}:${state.stalls.map((s) => s.id).join(",")}`);
  };
  const view = await render(createElement(Probe, { enabled: false }));
  assert.deepEqual(asked, [], "idle until the Visited tab is open");
  await view.rerender(createElement(Probe, { enabled: true }));
  await view.settle();
  assert.equal(view.text(), "ready:new,old");
  assert.equal(asked.length, 1, "one batched read");
});

test("useSavedStalls reads saved stalls in 50-id batches, newest first, and stays idle until wanted", async () => {
  stallInteractions(60);
  const asked: number[] = [];
  stub(getHungryService().discovery, "getVenuesByIds", async (ids: string[]) => {
    asked.push(ids.length);
    return ids.map((id) => ({ id, name: `Stall ${id}` }) as VenueSummary);
  });
  const Probe = ({ enabled }: { enabled: boolean }) => {
    const state = useSavedStalls(enabled);
    return createElement(
      Text,
      null,
      `${state.status}:${state.stalls.length}:${state.stalls[0]?.id ?? "-"}`,
    );
  };
  const view = await render(createElement(Probe, { enabled: false }));
  assert.deepEqual(asked, [], "nothing is read until a section needs stalls");
  await view.rerender(createElement(Probe, { enabled: true }));
  await view.settle();
  assert.equal(view.text(), "ready:60:s0");
  assert.deepEqual(asked, [50, 10]);
});

test("useSavedStalls reports a failed read and recovers on retry", async () => {
  stallInteractions(2);
  let fail = true;
  stub(getHungryService().discovery, "getVenuesByIds", async (ids: string[]) => {
    if (fail) throw new Error("offline");
    return ids.map((id) => ({ id, name: id }) as VenueSummary);
  });
  const handle: { retry: () => void } = { retry: () => undefined };
  const Probe = () => {
    const state = useSavedStalls(true);
    handle.retry = state.retry;
    return createElement(Text, null, `${state.status}:${state.stalls.length}`);
  };
  const view = await render(createElement(Probe));
  await view.settle();
  assert.equal(view.text(), "error:0");
  fail = false;
  handle.retry();
  await view.settle();
  assert.equal(view.text(), "ready:2");
});

function SearchProbe({ rawQuery }: { rawQuery: string }) {
  const search = useSavedSearch({
    rawQuery,
    userId: "user",
    dishes: [{ id: "d1", name: "Laksa", venueName: "Nam Sing" }],
    stalls: [],
    lists: [],
  });
  return createElement(Text, null, `${search.status}:${search.query}:${search.results.total}`);
}

test("useSavedSearch waits for typing to stop, then reads reviews once", async () => {
  let reads = 0;
  stub(getHungryService().reviews, "getUserReviews", async () => {
    reads += 1;
    return [] as Review[];
  });
  stub(getHungryService().discovery, "getItemDetails", async () => []);
  const view = await render(createElement(SearchProbe, { rawQuery: "" }));
  assert.equal(view.text(), "idle::0");
  await view.rerender(createElement(SearchProbe, { rawQuery: "lak" }));
  assert.equal(reads, 0, "no read while the debounce is running");
  await sleep(SAVED_SEARCH_DEBOUNCE_MS + 60);
  await view.settle();
  assert.equal(view.text(), "ready:lak:1");
  assert.equal(reads, 1);
  await view.rerender(createElement(SearchProbe, { rawQuery: "laksa" }));
  await sleep(SAVED_SEARCH_DEBOUNCE_MS + 60);
  await view.settle();
  assert.equal(view.text(), "ready:laksa:1");
  assert.equal(reads, 1, "a longer query filters in memory");
  await view.rerender(createElement(SearchProbe, { rawQuery: "   " }));
  assert.equal(view.text(), "idle::0");
});

test("useSavedSearch shows an error when your reviews can't be read and nothing matched", async () => {
  stub(getHungryService().reviews, "getUserReviews", async () => {
    throw new Error("offline");
  });
  const view = await render(createElement(SearchProbe, { rawQuery: "pizza" }));
  await sleep(SAVED_SEARCH_DEBOUNCE_MS + 60);
  await view.settle();
  assert.match(view.text(), /^error:pizza:0/);
});

test("useListCovers reads the lists' items, then only the first dishes' photos, once", async () => {
  usePortfolioStore.setState({
    items: {
      l1: ["d1", "d2", "d3", "d4", "d5"].map(
        (id, position) =>
          ({
            id: `i-${id}`,
            portfolioId: "l1",
            itemType: "dish",
            dishId: id,
            position,
          }) as PortfolioItem,
      ),
    },
  });
  stub(usePortfolioStore.getState(), "loadItemsForPortfolios", async () => undefined);
  const reads: string[][] = [];
  stub(getHungryService().discovery, "getItemDetails", async (input) => {
    reads.push(input.dishIds);
    return input.dishIds.map((id) => ({ dishId: id, name: id, imageUrl: `https://img/${id}` }));
  });
  const lists = [{ id: "l1" } as Portfolio];
  const Probe = () => {
    const covers = useListCovers(lists.map((list) => list.id));
    return createElement(Text, null, (covers.get("l1") ?? []).join(","));
  };
  const view = await render(createElement(Probe));
  await view.settle();
  assert.deepEqual(reads, [["d1", "d2", "d3", "d4"]]);
  assert.equal(view.text(), "https://img/d1,https://img/d2,https://img/d3,https://img/d4");
});

test("useListCovers leaves covers empty when the photo read fails", async () => {
  usePortfolioStore.setState({
    items: {
      l1: [
        {
          id: "i1",
          portfolioId: "l1",
          itemType: "dish",
          dishId: "d1",
          position: 0,
        } as PortfolioItem,
      ],
    },
  });
  stub(usePortfolioStore.getState(), "loadItemsForPortfolios", async () => undefined);
  stub(getHungryService().discovery, "getItemDetails", async () => {
    throw new Error("offline");
  });
  const Probe = () => {
    const covers = useListCovers(["l1"]);
    return createElement(Text, null, `covers:${(covers.get("l1") ?? []).length}`);
  };
  const view = await render(createElement(Probe));
  await view.settle();
  assert.equal(view.text(), "covers:0");
});
