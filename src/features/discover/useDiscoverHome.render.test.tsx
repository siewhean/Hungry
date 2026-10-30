// The two hooks behind Home: useDiscoverFilters (chips) and useDiscoverFeed (place and data).
// Run with `node scripts/test-render.mjs src/features/discover/useDiscoverHome.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { useDiscoverFeed } from "@/features/discover/useDiscoverFeed";
import { useDiscoverFilters } from "@/features/discover/useDiscoverFilters";
import { useProfileStore } from "@/store/useProfileStore";
import { cleanup, render } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import type { DishDetail } from "@/types/domain";

beforeEach(async () => {
  await enterScenario("user");
  clearTrackedAnalyticsEvents();
});
afterEach(cleanup);

type Filters = ReturnType<typeof useDiscoverFilters>;

async function mountFilters(options: { openedSettings?: string[]; hours?: string } = {}) {
  let latest: Filters | undefined;
  function Probe() {
    latest = useDiscoverFilters({
      getVenueHours: () => options.hours,
      onOpenDietarySettings: () => options.openedSettings?.push("dietary"),
    });
    return null;
  }
  const view = await render(<Probe />);
  return { view, filters: () => latest as Filters };
}

function dish(overrides: Partial<DishDetail> = {}): DishDetail {
  return {
    id: "d1",
    name: "Laksa",
    venueId: "v1",
    price: 4.5,
    dietaryFlags: ["halal"],
    tasteTags: [],
    tasteVector: { spicy: 7 },
    ...overrides,
  } as DishDetail;
}

test("useDiscoverFilters starts with no chips and a chip taps on and off", async () => {
  useProfileStore.getState().setDietaryPreferences([]);
  const { view, filters } = await mountFilters();
  assert.deepEqual(filters().activeDiscoverChipIds, []);
  assert.equal(filters().isDiscoverFiltering, false);

  filters().toggleDiscoverChip("spicy");
  await view.settle();
  assert.deepEqual(filters().activeDiscoverChipIds, ["spicy"]);
  assert.equal(filters().isDiscoverFiltering, true);

  filters().toggleDiscoverChip("spicy");
  await view.settle();
  assert.deepEqual(filters().activeDiscoverChipIds, []);
});

test("the dietary chip opens dietary settings when none are saved, and filters once they are", async () => {
  useProfileStore.getState().setDietaryPreferences([]);
  const openedSettings: string[] = [];
  const { view, filters } = await mountFilters({ openedSettings });

  filters().toggleDiscoverChip("dietary");
  await view.settle();
  assert.deepEqual(openedSettings, ["dietary"]);
  assert.deepEqual(filters().activeDiscoverChipIds, [], "nothing to filter by yet");

  useProfileStore.getState().setDietaryPreferences(["halal"]);
  await view.settle();
  assert.deepEqual(filters().activeDiscoverChipIds, ["dietary"], "saving a need switches it on");
});

test("clearing the filters empties the chips and says so", async () => {
  useProfileStore.getState().setDietaryPreferences([]);
  const { view, filters } = await mountFilters();
  filters().toggleDiscoverChip("halal");
  await view.settle();
  filters().clearDiscoverFilters();
  await view.settle();
  assert.deepEqual(filters().activeDiscoverChipIds, []);
  assert.ok(
    getTrackedAnalyticsEvents().some((record) => record.event === "home_filters_cleared"),
    "the clear is tracked",
  );
});

test("each chip keeps only the dishes it describes", async () => {
  useProfileStore.getState().setDietaryPreferences([]);
  const { view, filters } = await mountFilters();
  filters().toggleDiscoverChip("halal");
  await view.settle();
  filters().toggleDiscoverChip("cheap");
  await view.settle();

  const matches = filters().matchesDiscoverChipSelection;
  assert.equal(matches(dish()), true, "halal and under S$5");
  assert.equal(matches(dish({ dietaryFlags: [] })), false, "not halal");
  assert.equal(matches(dish({ price: 9 })), false, "over the cheap limit");
});

test("the chip row leads with the dietary chip and always has the intent chips", async () => {
  useProfileStore.getState().setDietaryPreferences([]);
  const { filters } = await mountFilters();
  const ids = filters().sortedChips.map((chip) => chip.id);
  // From 21:00 to 03:59 in Singapore "Late night" leads the row, so the clock must not fail this.
  assert.equal(ids.filter((id) => id !== "late")[0], "dietary");
  for (const id of ["spicy", "halal", "cheap"]) assert.ok(ids.includes(id as never), id);
});

test("useDiscoverFeed names the place and builds the stall and dish lists", async () => {
  let latest: ReturnType<typeof useDiscoverFeed> | undefined;
  function Probe() {
    latest = useDiscoverFeed();
    return null;
  }
  const view = await render(<Probe />);
  await view.settle();
  const feed = latest!;

  assert.equal(feed.isSupabaseDataSource, false, "tests read the local data");
  assert.ok(feed.discoverHeaderLabel.length > 0);
  assert.ok(feed.discoverLocationLabel.length > 0);
  assert.equal(feed.discoverLoadError, false);
  assert.ok(feed.areaVenues.length > 0, "the local data has stalls around the diner");
  assert.ok(feed.areaDishPool.length > 0, "and dishes to pick from");
  assert.equal(
    feed.getVenueHours(feed.areaVenues[0].id),
    feed.areaVenues[0].operatingHours || undefined,
  );
});
