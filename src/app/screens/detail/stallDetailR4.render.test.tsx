// Round-four stall page fixes (R4-STALL-*). Run with `npm run test:render`.

import assert from "node:assert/strict";
import { createElement, Fragment } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { StallDetailScreen } from "@/app/screens/detail/StallDetailScreen";
import { StallInteractionBar } from "@/components/stall/StallInteractionBar";
import { FloatingToast } from "@/components/ui/FloatingToast";
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
import { useProfileStore } from "@/store/useProfileStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render, renderScreen } from "@/test/render";
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

// ─── Save: "Add to a list" on the toast, and a hold row that says what it does ───────────

// Not saved in the mock account (Tian Tian and Satay Street are).
const UNSAVED_STALL = "venue-ban-mian";

const barWithToast = (stallId: string, extra: Record<string, unknown> = {}) =>
  createElement(
    Fragment,
    null,
    createElement(StallInteractionBar, {
      layout: "sticky",
      stallId,
      userId: useProfileStore.getState().profile.id,
      ...extra,
    }),
    createElement(FloatingToast, {}),
  );

async function holdDown(view: Awaited<ReturnType<typeof render>>, target: HTMLElement | null) {
  assert.ok(target, "hold target not found");
  const init = { bubbles: true, cancelable: true, button: 0 };
  const PointerCtor = (window as unknown as { PointerEvent?: typeof MouseEvent }).PointerEvent;
  target.dispatchEvent(
    PointerCtor ? new PointerCtor("pointerdown", init) : new window.MouseEvent("mousedown", init),
  );
  await new Promise((resolve) => setTimeout(resolve, 600));
  target.dispatchEvent(
    PointerCtor ? new PointerCtor("pointerup", init) : new window.MouseEvent("mouseup", init),
  );
  await view.settle();
}

test("R4-STALL-6: the save toast offers Add to a list, and pressing it opens the list sheet", async () => {
  useUIStore.setState({ toast: null });
  const opened: string[] = [];
  const view = await render(barWithToast(UNSAVED_STALL, { onAddToList: () => opened.push("list") }));
  await view.press(view.findByLabel("Save this stall"));
  assert.match(view.text(), /Saved\. Find it in Profile, Saved, Stalls/);
  const action = view.findByLabel("Add to a list");
  assert.ok(action, "the toast carries an Add to a list button");
  assert.equal(action.getAttribute("role"), "button", "it is a real button a screen reader can press");
  await view.press(action);
  assert.deepEqual(opened, ["list"]);
  assert.equal(useUIStore.getState().toast, null, "pressing it dismisses the toast");
});

test("R4-STALL-6: without a list sheet the save toast has no action", async () => {
  useUIStore.setState({ toast: null });
  const view = await render(barWithToast(UNSAVED_STALL));
  await view.press(view.findByLabel("Save this stall"));
  assert.match(view.text(), /Saved\./);
  assert.equal(view.findByLabel("Add to a list"), null);
});

test("R4-STALL-6: the hold menu of a saved stall says 'Remove from saved' and un-saves", async () => {
  const view = await render(barWithToast(STALL, { onAddToList: () => undefined }));
  // Wait for the account's saved stalls to load: Tian Tian is saved in the mock account.
  await view.settle();
  assert.ok(view.findByLabel("Saved"), "the stall shows as saved");
  await holdDown(view, view.findByLabel("Saved"));
  assert.equal(view.findByText("Saved stalls"), null, "the toggling row no longer reads 'Saved stalls'");
  const row = view.findByLabel("Remove from saved");
  assert.ok(row, "the hold menu has a Remove from saved row");
  await view.press(row);
  assert.equal(useStallInteractionStore.getState().interactions[STALL]?.isSaved, false);
});

test("R4-STALL-6: the hold menu of an unsaved stall offers 'Saved stalls' and saves", async () => {
  const view = await render(barWithToast(UNSAVED_STALL, { onAddToList: () => undefined }));
  await view.settle();
  await holdDown(view, view.findByLabel("Save this stall"));
  await view.press(view.findByLabel("Saved stalls"));
  assert.equal(useStallInteractionStore.getState().interactions[UNSAVED_STALL]?.isSaved, true);
});
