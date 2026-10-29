// Merchant round-four phase 1 in a React tree: Home inbox entry, inbox refocus, Stall's pick on the
// diner stall page, Insights built from real data.
// Run with `node scripts/test-render.mjs src/app/screens/merchant/merchant-r4-phase1.render.test.tsx`.

import assert from "node:assert/strict";
import { act } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { StallDetailScreen } from "@/app/screens/detail/StallDetailScreen";
import { AIAssistantScreen } from "@/app/screens/merchant/AIAssistantScreen";
import { CustomerInboxScreen } from "@/app/screens/merchant/CustomerInboxScreen";
import { MerchantDashboardScreen } from "@/app/screens/merchant/MerchantDashboardScreen";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
  setServiceProvider,
} from "@/lib/services/serviceProvider";
import { getActiveOutlet, useMerchantStore } from "@/store/useMerchantStore";
import { cleanup, createFakeNavigation, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { CustomerInteraction } from "@/types/domain";

type Merchant = ReturnType<typeof getHungryService>["merchant"];
const restores: (() => void)[] = [];
function stub<K extends keyof Merchant>(name: K, impl: Merchant[K]) {
  const merchant = getHungryService().merchant;
  const original = merchant[name];
  merchant[name] = impl;
  restores.push(() => {
    merchant[name] = original;
  });
}
const baseProvider = getServiceProvider();

afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()?.();
  setServiceProvider(baseProvider);
});

function outletId() {
  const outlet = getActiveOutlet(useMerchantStore.getState());
  assert.ok(outlet, "merchant scenario has an outlet");
  return outlet.id;
}

function review(index: number, reply?: string): CustomerInteraction {
  return {
    id: `review-${String(index).padStart(3, "0")}`,
    outletId: outletId(),
    type: "review",
    authorName: `Reviewer ${index}`,
    rating: 4,
    text: `Review text ${index}`,
    tags: [],
    createdAt: new Date(Date.UTC(2026, 9, 20, 12, 0, 0) - index * 60000).toISOString(),
    reply: reply ? { text: reply, repliedAt: "2026-10-21T00:00:00Z" } : undefined,
    sentiment: "positive",
  } as CustomerInteraction;
}

// ─── R4-6: one inbox entry on Home, and it opens All ────────────────────────

test("R4-6: Home has one 'Recent reviews' entry; See all and the latest review open the All filter", async () => {
  await enterScenario("merchant");
  stub("getInbox", async () => [review(7)]);
  const view = await renderScreen(MerchantDashboardScreen as never, { name: "Dashboard" });
  const headings = Array.from(document.body.querySelectorAll("*")).filter(
    (el) =>
      Array.from(el.childNodes)
        .map((n) => n.textContent)
        .join("")
        .trim() === "Recent reviews",
  );
  assert.equal(headings.length, 1, "no second 'Recent reviews' card");

  await view.press(view.findByText("See all"));
  const first = view.navigation.calls.filter((call) => call.method === "navigate").pop();
  assert.deepEqual(first?.args, ["CustomerInbox", { filter: "all" }]);

  await view.press(view.findByLabel(/^Latest review from/));
  const last = view.navigation.calls.filter((call) => call.method === "navigate").pop();
  assert.deepEqual(last?.args, ["CustomerInbox", { filter: "all" }]);
});

// ─── R4-7: the inbox refetches when the tab is focused again ────────────────

test("R4-7: coming back to the inbox shows a review that arrived meanwhile and keeps older pages", async () => {
  await enterScenario("merchant");
  let pages = Array.from({ length: 40 }, (_, i) => review(i + 1));
  const calls: unknown[] = [];
  stub("getInbox", async (_id, filters) => {
    calls.push(filters);
    let rows = pages;
    if (filters?.before) {
      rows = rows.slice(rows.findIndex((item) => item.id === filters.beforeId) + 1);
    }
    return rows.slice(0, filters?.limit ?? 200);
  });
  const navigation = createFakeNavigation();
  const listeners: Record<string, (() => void)[]> = {};
  (navigation as { addListener: unknown }).addListener = (event: string, listener: () => void) => {
    (listeners[event] ??= []).push(listener);
    return () => undefined;
  };
  const refocus = async () => {
    await act(async () => {
      listeners.blur?.forEach((listener) => listener());
      listeners.focus?.forEach((listener) => listener());
    });
    await view.settle();
  };
  const view = await renderScreen(CustomerInboxScreen as never, {
    name: "CustomerInbox",
    navigation,
  });
  await view.press(view.findByText("Load older reviews"));
  assert.match(view.text(), /Reviewer 40/);
  const before = calls.length;

  // Nothing new: the page refetches quietly and the loaded older page stays.
  await refocus();
  assert.equal(calls.length, before + 1, "one quiet refetch");
  assert.match(view.text(), /Reviewer 40/);

  // A new review arrives: it shows up on top after the next focus.
  pages = [review(0), ...pages];
  await refocus();
  assert.match(view.text(), /Review text 0Reply/);
});

// ─── R4-2: Stall's pick on the diner stall page ─────────────────────────────

test("R4-2: a Featured dish leads the diner menu with a Stall's pick badge", async () => {
  await enterScenario("user");
  const STALL = "venue-tian-tian";
  const dishes = getDataRepository().listDishesByVenue(STALL);
  assert.ok(dishes.length >= 2, "mock stall has a menu");
  // The alphabetically last dish is the one the stall features.
  const sorted = [...dishes].sort((a, b) => a.name.localeCompare(b.name));
  const pick = { ...sorted[sorted.length - 1], availabilityFlags: ["featured"] };
  const rest = dishes.filter((dish) => dish.id !== pick.id);
  const base = getServiceProvider();
  const service = {
    ...base.service,
    discovery: {
      ...base.service.discovery,
      getVenue: async () => getDataRepository().getVenueById(STALL),
      listDishesByVenue: async () => [...rest, pick],
      getVenueOpeningSchedule: async () => undefined,
      getPublicMerchantProfile: async () => undefined,
    },
  };
  setServiceProvider({ ...base, mode: "supabase", service });
  const view = await renderScreen(StallDetailScreen as never, {
    name: "StallDetail",
    params: { venueId: STALL },
  });
  assert.match(view.text(), /STALL'S PICK/);
  // Menu cards are buttons labelled "<name>, ..." in page order.
  const labels = (Array.from(document.body.querySelectorAll("[aria-label]")) as HTMLElement[])
    .map((el) => el.getAttribute("aria-label") ?? "")
    .filter((label) => /, /.test(label));
  const pickAt = labels.findIndex((label) => label.startsWith(`${pick.name}, stall's pick`));
  assert.ok(pickAt >= 0, "the featured dish is read out as the stall's pick");
  for (const dish of rest) {
    const at = labels.findIndex((label) => label.startsWith(`${dish.name},`));
    if (at >= 0) assert.ok(pickAt < at, `${pick.name} comes before ${dish.name}`);
  }
});

// ─── R4-3: Insights come from the stall's own data ──────────────────────────

test("R4-3: Insights show tips built from the menu, the inbox and the hours, not canned cards", async () => {
  await enterScenario("merchant");
  const view = await renderScreen(AIAssistantScreen as never, { name: "AIAssistant" });
  assert.match(view.text(), /Last 7 days/);
  assert.match(view.text(), /\d+ reviews? waiting for a reply/);
  assert.doesNotMatch(view.text(), /Your desserts get more saves at night/);
  assert.doesNotMatch(view.text(), /missing ingredients/);
});
