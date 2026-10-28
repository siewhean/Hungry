// Round-four stall page fixes (R4-STALL-*). Run with `npm run test:render`.

import assert from "node:assert/strict";
import { createElement, Fragment } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { StallDetailScreen } from "@/app/screens/detail/StallDetailScreen";
import { StallInteractionBar } from "@/components/stall/StallInteractionBar";
import { FloatingToast } from "@/components/ui/FloatingToast";
import { resetExperimentSession, setExperimentFlagSource } from "@/lib/experiments/experiments";
import {
  getDataRepository,
  getHungryService,
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
  const view = await render(
    barWithToast(UNSAVED_STALL, { onAddToList: () => opened.push("list") }),
  );
  await view.press(view.findByLabel("Save this stall"));
  assert.match(view.text(), /Saved\. Find it in Profile, Saved, Stalls/);
  const action = view.findByLabel("Add to a list");
  assert.ok(action, "the toast carries an Add to a list button");
  assert.equal(
    action.getAttribute("role"),
    "button",
    "it is a real button a screen reader can press",
  );
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
  assert.equal(
    view.findByText("Saved stalls"),
    null,
    "the toggling row no longer reads 'Saved stalls'",
  );
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

// ─── Menu layout: rows when most dishes have no photo (R4-STALL-5) ───────────────────────

const restores: (() => void)[] = [];
afterEach(() => {
  while (restores.length) restores.pop()?.();
});

/** The mock stall's menu, cut to `total` dishes of which the first `withPhoto` have a photo. */
function useMenuWithPhotos(withPhoto: number, total: number) {
  const repo = getDataRepository();
  const source = repo.listDishesByVenue(STALL);
  assert.ok(source.length >= total, "the mock stall has enough dishes");
  const dishes = source.slice(0, total).map((dish, index) => ({
    ...dish,
    imageUrl: index < withPhoto ? "https://images.hungry.test/dish.jpg" : "",
    gallery: [],
  }));
  const original = repo.listDishesByVenue;
  repo.listDishesByVenue = () => dishes;
  restores.push(() => {
    repo.listDishesByVenue = original;
  });
  return dishes;
}

test("R4-STALL-5: a menu where no dish has a photo is list rows, not a grid of grey squares", async () => {
  const dishes = useMenuWithPhotos(0, 3);
  const view = await openStall();
  assert.ok(view.container.querySelector('[data-testid="stall-menu-list"]'), "list rows");
  assert.equal(view.container.querySelector('[data-testid="stall-menu-grid"]'), null);
  assert.equal(view.findByLabel(/no photo yet/), null, "no grey placeholder tiles");
  for (const dish of dishes) assert.ok(view.findByText(dish.name), `${dish.name} is listed`);
});

test("R4-STALL-5: a menu where most dishes have photos keeps the photo grid", async () => {
  useMenuWithPhotos(3, 3);
  const view = await openStall();
  assert.ok(view.container.querySelector('[data-testid="stall-menu-grid"]'), "photo grid");
  assert.equal(view.container.querySelector('[data-testid="stall-menu-list"]'), null);
});

test("R4-STALL-5: the layout follows the whole menu: 2 of 3 with photos is a grid, 1 of 3 a list", async () => {
  useMenuWithPhotos(2, 3);
  let view = await openStall();
  assert.ok(view.container.querySelector('[data-testid="stall-menu-grid"]'));
  await cleanup();
  while (restores.length) restores.pop()?.();
  useMenuWithPhotos(1, 3);
  view = await openStall();
  assert.ok(view.container.querySelector('[data-testid="stall-menu-list"]'));
});

test("R4-STALL-5: pressing a menu row opens that dish", async () => {
  const [first] = useMenuWithPhotos(0, 3);
  const view = await openStall();
  await view.press(view.findByLabel(new RegExp(`^${first.name}`)));
  assert.deepEqual(view.navigation.calls.find((call) => call.method === "navigate")?.args, [
    "DishDetail",
    { dishId: first.id },
  ]);
});

// ─── The empty stall (R4-STALL-1) ────────────────────────────────────────────────────────

const EMPTY_STALL = "venue-empty-r4";

/** A licence-data stall: ALL CAPS name, no photo, no menu, no hours, no reviews. */
function useEmptyStall() {
  const repo = getDataRepository();
  const base = repo.getVenueById(STALL);
  assert.ok(base, "mock stall exists");
  const empty = {
    ...base,
    id: EMPTY_STALL,
    name: "TIAN TIAN HAINANESE CHICKEN RICE",
    imageUrl: undefined,
    logoUrl: undefined,
    operatingHours: "",
    openingSchedule: undefined,
    deliveryLinks: [],
    savedCount: 0,
  };
  const originalVenue = repo.getVenueById;
  const originalDishes = repo.listDishesByVenue;
  repo.getVenueById = (id: string) => (id === EMPTY_STALL ? empty : originalVenue.call(repo, id));
  repo.listDishesByVenue = (id: string) =>
    id === EMPTY_STALL ? [] : originalDishes.call(repo, id);
  restores.push(() => {
    repo.getVenueById = originalVenue;
    repo.listDishesByVenue = originalDishes;
  });
  const reviews = getHungryService().reviews;
  const originalReviews = reviews.listRecentReviewsPage;
  reviews.listRecentReviewsPage = async () => ({ entries: [], hasMore: false });
  restores.push(() => {
    reviews.listRecentReviewsPage = originalReviews;
  });
  return empty;
}

test("R4-STALL-1: an empty stall shows one 'Help us fill this in' card, not three empty cards", async () => {
  useEmptyStall();
  const view = await openStall(EMPTY_STALL);
  assert.ok(view.container.querySelector('[data-testid="stall-help-fill-card"]'), "the card");
  assert.match(view.text(), /Help us fill this in/);
  assert.match(view.text(), /No menu, hours and reviews yet/);
  assert.doesNotMatch(view.text(), /No menu available for this stall yet/);
  assert.doesNotMatch(view.text(), /No community reviews yet/);
  assert.equal(view.findByText("Menu"), null, "no empty Menu heading");
  assert.equal(view.findByText("Reviews"), null, "no empty Reviews heading");
  assert.ok(view.findByText("Write the first review"));
  assert.ok(view.findByText("Add opening hours"));
});

test("R4-STALL-1: an ALL CAPS name is shown in title case and the hero is the brand fallback", async () => {
  useEmptyStall();
  const view = await openStall(EMPTY_STALL);
  const heading = view.container.querySelector("h1");
  assert.equal(heading?.textContent, "Tian Tian Hainanese Chicken Rice");
  assert.ok(
    view.findByLabel("Tian Tian Hainanese Chicken Rice photo unavailable"),
    "the hero fallback is labelled",
  );
});

test("R4-STALL-1: Add opening hours opens the report page with 'opening hours' picked", async () => {
  useEmptyStall();
  const view = await openStall(EMPTY_STALL);
  await view.press(view.findByText("Add opening hours"));
  const call = view.navigation.calls.find((entry) => entry.method === "navigate");
  assert.deepEqual(call?.args, [
    "ReportProblem",
    {
      venueId: EMPTY_STALL,
      subjectName: "Tian Tian Hainanese Chicken Rice",
      initialKind: "wrong_hours",
    },
  ]);
});

test("R4-STALL-1: Write the first review opens the composer for this stall", async () => {
  useEmptyStall();
  const view = await openStall(EMPTY_STALL);
  await view.press(view.findByText("Write the first review"));
  const call = view.navigation.calls.find((entry) => entry.method === "navigate");
  assert.deepEqual(call?.args, [
    "ReviewStack",
    { screen: "ReviewMain", params: { venueId: EMPTY_STALL } },
  ]);
});

test("R4-STALL-1: a stall with a menu keeps its Menu section and does not get the card", async () => {
  const view = await openStall();
  assert.equal(view.container.querySelector('[data-testid="stall-help-fill-card"]'), null);
  assert.ok(view.findByText("Menu"));
});

test("R4-STALL-1: the report page opens with 'opening hours' picked when asked to", async () => {
  const { ReportProblemScreen } = await import("@/app/screens/detail/ReportProblemScreen");
  const supply = getHungryService().supply;
  const sent: unknown[] = [];
  const original = supply.submitCatalogCorrection;
  supply.submitCatalogCorrection = async (input) => {
    sent.push(input);
  };
  restores.push(() => {
    supply.submitCatalogCorrection = original;
  });
  let view = await renderScreen(ReportProblemScreen as never, {
    name: "ReportProblem",
    params: { venueId: STALL, subjectName: "Tian Tian", initialKind: "wrong_hours" },
  });
  // Without picking a reason first: the hours reason is already chosen.
  await view.press(view.findByText("Send report"));
  assert.deepEqual(sent, [{ venueId: STALL, dishId: undefined, kind: "wrong_hours" }]);
  await cleanup();
  sent.length = 0;
  view = await renderScreen(ReportProblemScreen as never, {
    name: "ReportProblem",
    params: { venueId: STALL, subjectName: "Tian Tian" },
  });
  await view.press(view.findByText("Send report"));
  assert.deepEqual(sent, [], "with no reason picked nothing is sent");
});
