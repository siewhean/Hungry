// Stall page fixes from the round-three audit (STALL-*). Run with `npm run test:render`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { StallDetailScreen } from "@/app/screens/detail/StallDetailScreen";
import { ReportProblemScreen } from "@/app/screens/detail/ReportProblemScreen";
import { FavouritesScreen } from "@/app/screens/profile/FavouritesScreen";
import { StallInteractionBar } from "@/components/stall/StallInteractionBar";
import { PhotoPager } from "@/components/dish/PhotoPager";
import {
  resetExperimentSession,
  setExperimentFlagSource,
  type ExperimentFlagSource,
} from "@/lib/experiments/experiments";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, createFakeNavigation, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

const STALL = "venue-tian-tian";
const restores: (() => void)[] = [];

function override<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}

beforeEach(async () => {
  await enterScenario("user");
  useStallInteractionStore.getState()._reset();
});

afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()?.();
  setExperimentFlagSource(undefined);
  resetExperimentSession();
});

const openStall = (venueId = STALL) =>
  renderScreen(StallDetailScreen as never, { name: "StallDetail", params: { venueId } });

function accessibleNodes(root: ParentNode) {
  return Array.from(root.querySelectorAll("[aria-label]")) as HTMLElement[];
}

test("STALL-X3: Back is the first thing a screen reader reaches on the stall page", async () => {
  const view = await openStall();
  assert.match(view.text(), /Tian Tian Chicken Rice/);
  assert.equal(accessibleNodes(view.container)[0]?.getAttribute("aria-label"), "Go back");
  assert.ok(view.findByLabel("Share stall"));
});

test("STALL-V1: Back and Share sit in a raised wrapper so the hero photo cannot cover them", async () => {
  const view = await openStall();
  const chrome = view.container.querySelector(
    '[data-testid="stall-detail-top-chrome"]',
  ) as HTMLElement | null;
  assert.ok(chrome, "the top chrome wrapper is rendered");
  assert.ok(Number(chrome.style.zIndex) >= 10, `zIndex is ${chrome.style.zIndex}`);
  const labels = accessibleNodes(chrome).map((node) => node.getAttribute("aria-label"));
  assert.deepEqual(labels, ["Go back", "Share stall"]);
  // The wrapper comes before the scroll view (and so before the hero photo).
  const firstPhoto = view.container.querySelector('[aria-label^="Photo "]');
  if (firstPhoto) {
    assert.ok(chrome.compareDocumentPosition(firstPhoto) & Node.DOCUMENT_POSITION_FOLLOWING);
  }
});

test("STALL-2: the hours toggle holds only the status; today and each day are their own text", async () => {
  const view = await openStall();
  const toggle = view.findByLabel(/^Opening hours, /) ?? (null as unknown as HTMLElement);
  assert.ok(toggle, "the hours header is on the page");
  // Today's line is outside the toggle, so its label does not swallow it.
  assert.doesNotMatch(toggle.textContent ?? "", /Today|Hours:/);
  // Tian Tian has weekly hours in the mock data, so the header must be a working toggle.
  assert.equal(toggle.getAttribute("role"), "button", "the hours header expands");
  {
    await view.press(toggle);
    const rows = accessibleNodes(view.container).filter(
      (node) =>
        node !== toggle &&
        !toggle.contains(node) &&
        /, /.test(node.getAttribute("aria-label") ?? "") &&
        !/^Opening hours/.test(node.getAttribute("aria-label") ?? ""),
    );
    assert.ok(
      rows.some((node) => /AM|PM|am|pm|Closed/.test(node.getAttribute("aria-label") ?? "")),
      "each expanded day is announced as its own text",
    );
  }
});

test("STALL-10: the menu grid is titled Menu", async () => {
  const view = await openStall();
  assert.ok(view.findByText("Menu"));
  assert.equal(view.findByText("Signature dishes"), null);
});

test("STALL-X2: the couldn't-load state has a way back", async () => {
  override(getHungryService().discovery, "getVenue", async () => {
    throw new Error("offline");
  });
  const view = await openStall("venue-not-cached");
  assert.match(view.text(), /Couldn't load this stall/);
  const back = view.findByLabel("Go back");
  assert.ok(back);
  await view.press(back);
  assert.ok(view.navigation.calls.some((call) => call.method === "goBack"));
});

/** Collects reportError calls (it logs them under __DEV__). */
async function collectReports(body: () => Promise<void>) {
  const reports: unknown[][] = [];
  const original = console.error;
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  globals.__DEV__ = true;
  console.error = (...args: unknown[]) => {
    if (args[0] === "[reportError]") reports.push(args.slice(1));
  };
  try {
    await body();
  } finally {
    console.error = original;
    globals.__DEV__ = previousDev;
  }
  return reports;
}

test("STALL-V3: a stall opened offline sends no error reports; a real failure still does", async () => {
  const offline = await collectReports(async () => {
    override(getHungryService().discovery, "getVenue", async () => {
      throw new TypeError("Network request failed");
    });
    const view = await openStall("venue-not-cached");
    assert.match(view.text(), /Couldn't load this stall/);
  });
  assert.equal(offline.length, 0, `reports: ${JSON.stringify(offline)}`);
  await cleanup();

  const broken = await collectReports(async () => {
    getHungryService().discovery.getVenue = async () => {
      throw new Error("column venues.foo does not exist");
    };
    await openStall("venue-not-cached");
  });
  assert.ok(
    broken.some((args) => (args[1] as { action?: string })?.action === "load_venue"),
    "an unexpected failure is reported",
  );
});

test("STALL-7: a failed later menu page says so, with Retry, and the count shows more exist", async () => {
  const discovery = getHungryService().discovery;
  const real = await discovery.getVenue(STALL);
  assert.ok(real, "mock stall exists");
  const dishes = getDataRepository().listDishesByVenue(STALL);
  assert.ok(dishes.length >= 2, "mock stall has dishes");
  const id = "venue-paged";
  override(discovery, "getVenue", async () => ({ ...real, id }));
  const pageCalls: unknown[] = [];
  override(discovery, "listDishesByVenuePage", async (_venueId: string, cursor?: unknown) => {
    pageCalls.push(cursor);
    if (!cursor) {
      return {
        dishes: dishes.slice(0, 2).map((dish) => ({ ...dish, venueId: id })),
        nextCursor: { score: 1, id: "cursor-1" },
      };
    }
    throw new Error("search_dishes timed out");
  });
  const view = await openStall(id);
  assert.ok(pageCalls.length >= 2, "the next page was read");
  assert.match(view.text(), /Couldn't load the rest of the menu/);
  assert.match(view.text(), /2\+ items/);
  const before = pageCalls.length;
  await view.press(view.findByText("Retry"));
  assert.ok(pageCalls.length > before, "Retry reads the page again");
});

test("STALL-X4: the opening schedule is read on its own only when the venue has none", async () => {
  const discovery = getHungryService().discovery;
  const real = await discovery.getVenue(STALL);
  assert.ok(real);
  let scheduleReads = 0;
  override(discovery, "getVenueOpeningSchedule", async () => {
    scheduleReads += 1;
    return undefined;
  });
  const schedule = real.openingSchedule ?? ({ timezone: "Asia/Singapore", weekly: [] } as never);
  // Not in the local cache, so the page waits for the venue read like a Supabase build.
  const id = "venue-x4";
  override(discovery, "getVenue", async () => ({ ...real, id, openingSchedule: schedule }));
  await openStall(id);
  assert.equal(scheduleReads, 0, "get_venue_detail already carried the schedule");
  await cleanup();

  discovery.getVenue = async () => ({ ...real, id, openingSchedule: undefined });
  await openStall(id);
  assert.equal(scheduleReads, 1, "one read when the venue has no schedule");
});

test("STALL-12: See more reviews follows the server's hasMore, even when rows were dropped", async () => {
  const reviews = getHungryService().reviews;
  const firstPage = await reviews.listRecentReviewsPage({ venueId: STALL, limit: 1 });
  assert.ok(firstPage.entries.length > 0, "mock data has a review for this stall");
  override(reviews, "listRecentReviewsPage", async () => ({
    entries: firstPage.entries.slice(0, 1),
    hasMore: true,
    nextCursor: { before: "2026-01-01T00:00:00.000Z", beforeId: "review-x" },
  }));
  const view = await openStall();
  assert.ok(view.findByText("See more reviews"));
});

test("STALL-X6: an empty Reviews section offers Write a review", async () => {
  override(getHungryService().reviews, "listRecentReviewsPage", async () => ({
    entries: [],
    hasMore: false,
  }));
  const view = await openStall();
  assert.match(view.text(), /No community reviews yet/);
  const ctas = Array.from(view.container.querySelectorAll('[role="button"]')).filter(
    (node) => node.textContent?.trim() === "Write a review",
  );
  // One in the empty state, one in the bottom bar.
  assert.ok(ctas.length >= 2);
});

// Not saved in the mock account (Tian Tian and Satay Street are).
const UNSAVED_STALL = "venue-ban-mian";

test("STALL-1 + STALL-5: Save says where the stall went, and a guest's Save is finished after sign-in", async () => {
  const requests: string[] = [];
  const view = await render(
    createElement(StallInteractionBar, {
      layout: "sticky",
      stallId: UNSAVED_STALL,
      userId: useProfileStore.getState().profile.id,
      isAuthenticated: false,
      onRequireAuth: (_message: string, action: "save" | "tried") => requests.push(action),
    }),
  );
  await view.press(view.findByLabel("Save this stall"));
  assert.deepEqual(requests, ["save"]);

  await cleanup();
  const signedIn = await render(
    createElement(StallInteractionBar, {
      layout: "sticky",
      stallId: UNSAVED_STALL,
      userId: useProfileStore.getState().profile.id,
    }),
  );
  await signedIn.press(signedIn.findByLabel("Save this stall"));
  assert.match(
    useUIStore.getState().toast?.message ?? "",
    /Saved\. Find it in Profile, Saved, Stalls/,
  );
  assert.equal(useStallInteractionStore.getState().interactions[UNSAVED_STALL]?.isSaved, true);
});

test("STALL-1: Saved > Stalls lists saved stalls; the empty state no longer mentions Follow", async () => {
  const repo = getDataRepository();
  const original = repo.listStallInteractions;
  override(repo, "listStallInteractions", async () => []);
  const empty = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  await empty.press(empty.findByLabel("Saved stalls"));
  assert.match(empty.text(), /No saved stalls yet/);
  assert.match(empty.text(), /Tap Save on a stall page/);
  assert.doesNotMatch(empty.text(), /Follow/);
  await cleanup();

  // The account's saved stalls (user_stall_interactions.is_saved), not followed stalls.
  repo.listStallInteractions = original;
  useStallInteractionStore.getState()._reset();
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  await view.press(view.findByLabel("Saved stalls"));
  assert.ok(view.findByLabel("Open Tian Tian Chicken Rice"));
  assert.doesNotMatch(view.text(), /No saved stalls yet/);
});

function fakeFlags(flags: Record<string, string>) {
  const state = { exposures: 0 };
  const source: ExperimentFlagSource = {
    peek: (key) => flags[key],
    expose: (key) => {
      state.exposures += 1;
      return flags[key];
    },
    hasLoaded: () => true,
    onChange: () => () => undefined,
  };
  setExperimentFlagSource(source);
  return state;
}

const barProps = (extra: Record<string, unknown>) => ({
  layout: "sticky" as const,
  stallId: STALL,
  userId: useProfileStore.getState().profile.id,
  ...extra,
});

test("stall_bar_cta_v1: control keeps Write a review as the orange button", async () => {
  const flags = fakeFlags({ stall_bar_cta_v1: "control" });
  const view = await render(
    createElement(StallInteractionBar, barProps({ onDirections: () => {}, onReview: () => {} })),
  );
  assert.ok(view.findByLabel("Write a review"));
  assert.ok(view.findByLabel("Directions to this stall"));
  assert.equal(view.findByText("Review"), null);
  assert.equal(flags.exposures, 1);
});

test("stall_bar_cta_v1: directions_cta makes Directions the orange button and Review an icon", async () => {
  fakeFlags({ stall_bar_cta_v1: "directions_cta" });
  const directions: string[] = [];
  const view = await render(
    createElement(
      StallInteractionBar,
      barProps({ onDirections: () => directions.push("go"), onReview: () => {} }),
    ),
  );
  const cta = view.findByText("Directions");
  assert.ok(cta);
  assert.ok(view.findByText("Review"));
  await view.press(cta);
  assert.deepEqual(directions, ["go"]);
});

test("stall_bar_cta_v1: a bar without Directions never exposes the user", async () => {
  const flags = fakeFlags({ stall_bar_cta_v1: "directions_cta" });
  const view = await render(createElement(StallInteractionBar, barProps({ onReview: () => {} })));
  assert.ok(view.findByLabel("Write a review"));
  assert.equal(flags.exposures, 0);
});

test("STALL-15: the photo count never runs past the photos there are", async () => {
  const photos = [
    "https://example.com/a.jpg",
    "https://example.com/b.jpg",
    "https://example.com/c.jpg",
  ];
  const props = { width: 300, height: 200, subject: "Stall" };
  const view = await render(createElement(PhotoPager, { ...props, photos }));
  assert.ok(view.findByLabel("Photo 1 of 3"));
  await view.rerender(createElement(PhotoPager, { ...props, photos: photos.slice(0, 2) }));
  assert.ok(view.findByLabel("Photo 1 of 2"));
});

test("STALL-V5 / STALL-15: the open viewer's counter is clamped when photos drop out", async () => {
  const photos = [1, 2, 3, 4].map((n) => `https://example.com/${n}.jpg`);
  const props = { width: 300, height: 200, subject: "Stall" };
  const view = await render(createElement(PhotoPager, { ...props, photos }));
  await view.press(view.findByLabel("Photo 4 of 4, Stall"));
  assert.match(document.body.textContent ?? "", /4 \/ 4/, "the viewer is open on photo 4");
  await view.rerender(createElement(PhotoPager, { ...props, photos: photos.slice(0, 3) }));
  const text = document.body.textContent ?? "";
  assert.doesNotMatch(text, /4 \/ 3/);
  assert.match(text, /3 \/ 3/);
});

test("STALL-20: a capped report shows the server's words; a network error shows plain words", async () => {
  const supply = getHungryService().supply;
  const params = { venueId: STALL, subjectName: "Tian Tian" };

  override(supply, "submitCatalogCorrection", async () => {
    throw Object.assign(new Error("You have sent a lot of reports today. Try again tomorrow."), {
      code: "54000",
    });
  });
  let view = await renderScreen(ReportProblemScreen as never, { name: "ReportProblem", params });
  await view.press(view.findByLabel("Opening hours are wrong"));
  await view.press(view.findByText("Send report"));
  assert.match(useUIStore.getState().toast?.message ?? "", /a lot of reports today/);
  await cleanup();

  supply.submitCatalogCorrection = async () => {
    throw new TypeError("Network request failed");
  };
  view = await renderScreen(ReportProblemScreen as never, { name: "ReportProblem", params });
  await view.press(view.findByLabel("Opening hours are wrong"));
  await view.press(view.findByText("Send report"));
  assert.equal(
    useUIStore.getState().toast?.message,
    "Couldn't send your report. Check your connection and try again.",
  );
});

test("STALL-V4: after a report, a guest who signed in goes to the stall, others go back", async () => {
  override(getHungryService().supply, "submitCatalogCorrection", async () => undefined);
  const params = { venueId: STALL, subjectName: "Tian Tian" };
  const withStack = (names: string[]) => ({
    ...createFakeNavigation(),
    getState: () => ({
      index: names.length - 1,
      routes: names.map((name, index) => ({ key: `${name}-${index}`, name })),
      key: "root",
      routeNames: names,
      type: "stack",
      stale: false,
    }),
  });

  // Sign-in resets the root to [MainTabs, ReportProblem].
  const fromSignIn = withStack(["MainTabs", "ReportProblem"]);
  let view = await renderScreen(ReportProblemScreen as never, {
    name: "ReportProblem",
    params,
    navigation: fromSignIn as never,
  });
  await view.press(view.findByLabel("Opening hours are wrong"));
  await view.press(view.findByText("Send report"));
  assert.deepEqual(fromSignIn.calls.at(-1), {
    method: "replace",
    args: ["StallDetail", { venueId: STALL }],
  });
  await cleanup();

  const fromStall = withStack(["MainTabs", "StallDetail", "ReportProblem"]);
  view = await renderScreen(ReportProblemScreen as never, {
    name: "ReportProblem",
    params,
    navigation: fromStall as never,
  });
  await view.press(view.findByLabel("Opening hours are wrong"));
  await view.press(view.findByText("Send report"));
  assert.equal(fromStall.calls.at(-1)?.method, "goBack");
});

test("STALL-X7: with nothing to go back to, the stall page goes to the Home tab (Discover)", async () => {
  override(getHungryService().discovery, "getVenue", async () => undefined);
  const navigation = { ...createFakeNavigation(), canGoBack: () => false };
  const view = await renderScreen(StallDetailScreen as never, {
    name: "StallDetail",
    params: { venueId: "venue-missing" },
    navigation: navigation as never,
  });
  await view.press(view.findByText("Go to Home"));
  const call = navigation.calls.find((entry) => entry.method === "navigate");
  assert.deepEqual(call?.args, ["MainTabs", { screen: "Discover" }]);
});
