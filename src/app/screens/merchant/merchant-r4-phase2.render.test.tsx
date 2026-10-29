// Merchant round-four phase 2 in a React tree: pause store, Performance chart, Menu sections and
// inline price, refresh error and outlet-switch guard, dish editor lock/order/toast, reply
// composer quote and suggestion chips (ClosurePanel and DailyBarChart render inside the screens).
// Run with `node scripts/test-render.mjs src/app/screens/merchant/merchant-r4-phase2.render.test.tsx`.

import assert from "node:assert/strict";
import { act } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { CustomerInboxScreen } from "@/app/screens/merchant/CustomerInboxScreen";
import { DishEditorScreen } from "@/app/screens/merchant/DishEditorScreen";
import { MerchantAnalyticsScreen } from "@/app/screens/merchant/MerchantAnalyticsScreen";
import { MerchantDashboardScreen } from "@/app/screens/merchant/MerchantDashboardScreen";
import { MerchantMenuScreen } from "@/app/screens/merchant/MerchantMenuScreen";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import {
  EXPERIMENTS,
  resetExperimentSession,
  setExperimentFlagSource,
  type ExperimentFlagSource,
} from "@/lib/experiments/experiments";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getActiveOutlet, useMerchantStore } from "@/store/useMerchantStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, createFakeNavigation, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { CustomerInteraction, DishDetail } from "@/types/domain";

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

beforeEach(async () => {
  await enterScenario("merchant");
  clearTrackedAnalyticsEvents();
  useUIStore.getState().hideToast();
});

afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()?.();
  setExperimentFlagSource(undefined);
  resetExperimentSession();
});

function outletId() {
  const outlet = getActiveOutlet(useMerchantStore.getState());
  assert.ok(outlet, "merchant scenario has an outlet");
  return outlet.id;
}

async function baseDish(): Promise<DishDetail> {
  const menu = await getHungryService().merchant.getMenu(outletId());
  assert.ok(menu[0], "merchant scenario has a menu");
  return menu[0];
}

function dish(base: DishDetail, id: string, name: string, extra: Partial<DishDetail> = {}) {
  return {
    ...base,
    id,
    name,
    price: 5,
    priceRange: "S$5.00",
    availabilityFlags: [],
    dietaryFlags: [],
    tasteTags: [],
    isMerchantDraft: false,
    ...extra,
  } as DishDetail;
}

/** Renders the Menu and fires the stack's focus event like the navigator does. */
async function renderMenu() {
  const navigation = createFakeNavigation();
  const listeners: (() => void)[] = [];
  (navigation as { addListener: unknown }).addListener = (_event: string, listener: () => void) => {
    listeners.push(listener);
    return () => undefined;
  };
  const view = await renderScreen(MerchantMenuScreen as never, { name: "Menu", navigation });
  const focus = async () => {
    await act(async () => {
      listeners.forEach((listener) => listener());
    });
    await view.settle();
  };
  await focus();
  return { view, focus };
}

function fakeFlags(flags: Record<string, string>) {
  const source: ExperimentFlagSource = {
    peek: (key) => flags[key],
    expose: (key) => flags[key],
    hasLoaded: () => true,
    onChange: () => () => undefined,
  };
  setExperimentFlagSource(source);
}

// ─── R4-4: pause store ──────────────────────────────────────────────────────

test("R4-4: 'Closed today' on Home saves a closure, thanks the merchant and shows the status", async () => {
  const saved: unknown[] = [];
  const real = getHungryService().merchant.updateBusinessProfile.bind(getHungryService().merchant);
  stub("updateBusinessProfile", async (id, updates) => {
    saved.push(updates);
    return real(id, updates);
  });
  const view = await renderScreen(MerchantDashboardScreen as never, { name: "Dashboard" });
  await view.press(view.findByLabel(/Pause|status|Open|Closed/i));
  await view.press(view.findByText("Closed today"));
  await view.settle();
  assert.equal(saved.length, 1);
  const closedUntil = (saved[0] as { closedUntil: string }).closedUntil;
  assert.ok(new Date(closedUntil).getTime() > Date.now());
  assert.equal((saved[0] as { temporaryClosure: string }).temporaryClosure, "");
  assert.match(useUIStore.getState().toast?.message ?? "", /Closed today/);
  assert.ok(
    getTrackedAnalyticsEvents().some((event) => event.event === "merchant_closure_set"),
    "the closure is counted",
  );
  assert.match(view.text(), /Closed today/);
});

// ─── R4-5: Performance chart ────────────────────────────────────────────────

test("R4-5: Performance shows one bar per day, and 30 days draws 30 bars", async () => {
  const view = await renderScreen(MerchantAnalyticsScreen as never, { name: "Analytics" });
  const bars = () => document.querySelectorAll('[data-testid^="daily-bar-"]').length;
  assert.equal(bars(), 7);
  assert.match(view.text(), /Profile visits per day|profile visits/i);
  await view.press(view.findByText("30 days"));
  await view.settle();
  assert.equal(bars(), 30);
});

test("R4-5: a failed daily read leaves the totals on screen", async () => {
  stub("getDailySeries", async () => {
    throw new Error("series down");
  });
  const view = await renderScreen(MerchantAnalyticsScreen as never, { name: "Analytics" });
  assert.equal(document.querySelectorAll('[data-testid^="daily-bar-"]').length, 0);
  assert.match(view.text(), /Profile visits/);
});

// ─── R4-11/12: Menu sections, row and inline price ──────────────────────────

test("R4-12: the Menu groups dishes under section headers with counts, A to Z, others last", async () => {
  const base = await baseDish();
  stub("getMenu", async () => [
    dish(base, "d1", "Laksa", { availabilityFlags: ["section:Noodles"] }),
    dish(base, "d2", "Teh", { availabilityFlags: ["section:Drinks"] }),
    dish(base, "d3", "Mee Siam", { availabilityFlags: ["section:Noodles"] }),
    dish(base, "d4", "Kaya Toast"),
  ]);
  const { view } = await renderMenu();
  const text = view.text();
  assert.ok(text.indexOf("Drinks") < text.indexOf("Noodles"));
  assert.ok(text.indexOf("Noodles") < text.indexOf("Other"));
  const headers = Array.from(document.querySelectorAll('[role="heading"]')).map((el) =>
    el.textContent?.trim(),
  );
  assert.deepEqual(headers, ["Drinks1", "Noodles2", "Other1"]);
});

test("R4-12: a menu without sections has no headers", async () => {
  const base = await baseDish();
  stub("getMenu", async () => [dish(base, "d1", "Laksa"), dish(base, "d2", "Teh")]);
  const { view } = await renderMenu();
  assert.match(view.text(), /Laksa/);
  assert.equal(document.querySelectorAll('[role="heading"]').length, 0);
});

test("R4-11: a sold-out dish shows one 'Sold out' signal and the price is on the row", async () => {
  const base = await baseDish();
  stub("getMenu", async () => [
    dish(base, "d1", "Laksa", { availabilityFlags: ["sold_out"], priceRange: "S$6.50" }),
  ]);
  const { view } = await renderMenu();
  const row = view.findByLabel("Edit Laksa") as HTMLElement;
  assert.equal(row.textContent?.split("Sold out").length, 2, "one pill on the row");
  assert.match(view.text(), /S\$6\.50/);
  const name = view.findByText("Laksa");
  assert.notEqual(getComputedStyle(name as HTMLElement).textDecorationLine, "line-through");
});

test("R4-12: the price changes from the row without opening the editor", async () => {
  const base = await baseDish();
  stub("getMenu", async () => [dish(base, "d1", "Laksa", { priceRange: "S$5.00" })]);
  const edits: unknown[][] = [];
  stub("editDish", async (...args) => {
    edits.push(args);
    return dish(base, "d1", "Laksa");
  });
  const { view } = await renderMenu();
  await view.press(view.findByLabel("Change price of Laksa, S$5.00"));
  const field = view.findByLabel("Price (S$)");
  await view.type(field, "abc");
  await view.press(view.findByText("Save price"));
  assert.match(view.text(), /Enter a price between/);
  assert.equal(edits.length, 0, "an invalid price is not sent");

  await view.type(view.findByLabel("Price (S$)"), "6.5");
  await view.press(view.findByText("Save price"));
  await view.settle();
  assert.deepEqual(edits[0].slice(1), ["d1", { price: 6.5, priceRange: "S$6.50" }]);
  assert.match(view.text(), /S\$6\.50/);
  assert.doesNotMatch(view.text(), /Change price/);
  assert.equal(
    view.navigation.calls.filter((call) => call.method === "navigate").length,
    0,
    "the full editor stays closed",
  );
});

test("R4-12: a live dish before verification cannot be repriced from the row", async () => {
  useMerchantStore.getState().setVerificationStatus(outletId(), "in_review");
  const base = await baseDish();
  stub("getMenu", async () => [dish(base, "d1", "Laksa", { isMerchantDraft: false })]);
  const { view } = await renderMenu();
  assert.match(view.text(), /Verify to change live dishes/);
  const price = view.findByLabel("Change price of Laksa, S$5.00") as HTMLElement;
  assert.equal(price.getAttribute("aria-disabled"), "true");
});

// ─── R4-13 / R4-14: refresh error and outlet switch ─────────────────────────

test("R4-13: a failed refresh keeps the dishes on screen and says so in a banner", async () => {
  const base = await baseDish();
  let fail = false;
  stub("getMenu", async () => {
    if (fail) throw new Error("offline");
    return [dish(base, "d1", "Laksa")];
  });
  const { view, focus } = await renderMenu();
  assert.match(view.text(), /Laksa/);
  fail = true;
  await focus();
  assert.match(view.text(), /Laksa/);
  assert.match(view.text(), /Could not refresh your menu/);
  assert.doesNotMatch(view.text(), /Failed to load menu/);
});

test("R4-13: with nothing loaded yet a failed load still shows the retry state", async () => {
  stub("getMenu", async () => {
    throw new Error("offline");
  });
  const { view } = await renderMenu();
  assert.match(view.text(), /Failed to load menu/);
});

test("R4-14: the older outlet's menu never lands over the newer one", async () => {
  const base = await baseDish();
  const resolvers: Record<string, (menu: DishDetail[]) => void> = {};
  stub(
    "getMenu",
    (id: string) => new Promise<DishDetail[]>((resolve) => (resolvers[id] = resolve)),
  );
  const first = outletId();
  const navigation = createFakeNavigation();
  const listeners: (() => void)[] = [];
  (navigation as { addListener: unknown }).addListener = (_event: string, listener: () => void) => {
    listeners.push(listener);
    return () => undefined;
  };
  const view = await renderScreen(MerchantMenuScreen as never, { name: "Menu", navigation });
  await act(async () => listeners.forEach((listener) => listener()));

  // The merchant switches to another outlet while the first menu is still loading.
  const { account } = useMerchantStore.getState();
  assert.ok(account);
  const second = "outlet-second";
  await act(async () => {
    useMerchantStore.getState().setAccount({
      ...account,
      outlets: [...account.outlets, { ...account.outlets[0], id: second, name: "Second stall" }],
    });
    useMerchantStore.getState().setActiveOutlet(second);
  });
  await act(async () => listeners.forEach((listener) => listener()));
  await act(async () => {
    resolvers[second]?.([dish(base, "n1", "Second stall dish")]);
    resolvers[first]?.([dish(base, "o1", "First stall dish")]);
  });
  await view.settle();
  assert.match(view.text(), /Second stall dish/);
  assert.doesNotMatch(view.text(), /First stall dish/);
});

// ─── R4-15/16/18: dish editor ───────────────────────────────────────────────

test("R4-15: before verification a live dish opens read-only with a way to verify", async () => {
  useMerchantStore.getState().setVerificationStatus(outletId(), "in_review");
  const base = await baseDish();
  stub("getMenu", async () => [dish(base, "live-1", "Live Laksa", { isMerchantDraft: false })]);
  const view = await renderScreen(DishEditorScreen as never, {
    name: "DishEditor",
    params: { dishId: "live-1" },
  });
  assert.match(view.text(), /Verify your stall to edit dishes/);
  assert.equal(view.findByText("Save dish"), null);
  assert.ok(view.findByText("Remove from menu"), "removing is still allowed");
  await view.press(view.findByText("Open verification"));
  assert.deepEqual(view.navigation.calls.filter((c) => c.method === "navigate").pop()?.args, [
    "VerificationCentre",
  ]);
});

test("R4-15: a draft before verification stays editable", async () => {
  useMerchantStore.getState().setVerificationStatus(outletId(), "in_review");
  const base = await baseDish();
  stub("getMenu", async () => [dish(base, "draft-1", "Draft Laksa", { isMerchantDraft: true })]);
  const view = await renderScreen(DishEditorScreen as never, {
    name: "DishEditor",
    params: { dishId: "draft-1" },
  });
  assert.doesNotMatch(view.text(), /Verify your stall to edit dishes/);
  assert.ok(view.findByText("Save dish"));
});

test("R4-16: the editor asks for photo, name, price, description, then section", async () => {
  const view = await renderScreen(DishEditorScreen as never, { name: "DishEditor" });
  const order = [
    "Dish photo",
    "Dish name *",
    "Price (S$) *",
    "Description",
    "Menu section",
    "Tags",
  ].map((label) => view.text().indexOf(label));
  assert.ok(
    order.every((position) => position >= 0),
    `labels found: ${order}`,
  );
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
  );
  // The allergen check is one tap away, not a form field above the description.
  assert.doesNotMatch(view.text(), /Used for the allergen check only/);
  await view.press(view.findByText("Check ingredients for allergens"));
  assert.match(view.text(), /Used for the allergen check only/);
});

test("R4-18: a verified save goes back with a toast; no dialog to dismiss", async () => {
  const base = await baseDish();
  stub("getMenu", async () => [dish(base, "d1", "Laksa", { isMerchantDraft: false })]);
  stub("editDish", async () => dish(base, "d1", "Laksa"));
  const view = await renderScreen(DishEditorScreen as never, {
    name: "DishEditor",
    params: { dishId: "d1" },
  });
  await view.type(view.findByLabel("Price (S$) *"), "7.00");
  await view.press(view.findByText("Save dish"));
  await view.settle();
  assert.ok(view.navigation.calls.some((call) => call.method === "goBack"));
  assert.match(useUIStore.getState().toast?.message ?? "", /Saved/);
  assert.doesNotMatch(view.text(), /Dish updated/);
});

test("R4-18: before verification the dialog stays, because diners cannot see the dish yet", async () => {
  useMerchantStore.getState().setVerificationStatus(outletId(), "in_review");
  const view = await renderScreen(DishEditorScreen as never, { name: "DishEditor" });
  stub("addDish", async (_id, newDish) => newDish as DishDetail);
  await view.type(view.findByLabel("Dish name *"), "New laksa");
  await view.type(view.findByLabel("Price (S$) *"), "5.50");
  await view.press(view.findByText("Save dish"));
  await view.settle();
  assert.match(view.text(), /Diners will see your menu once Hungry verifies your stall/);
  assert.equal(useUIStore.getState().toast, null);
});

// ─── R4-21: reply composer ──────────────────────────────────────────────────

function review(index: number, text = `Review text ${index}`): CustomerInteraction {
  return {
    id: `review-${index}`,
    outletId: outletId(),
    type: "review",
    authorName: `Mei Ling ${index}`,
    rating: 2,
    text,
    tags: [],
    createdAt: new Date(Date.UTC(2026, 9, 20, 12, 0, 0)).toISOString(),
    sentiment: "negative",
  } as CustomerInteraction;
}

async function openComposer() {
  stub("getInbox", async () => [review(1, "The soup was cold when it reached me.")]);
  const view = await renderScreen(CustomerInboxScreen as never, { name: "CustomerInbox" });
  await view.press(view.findByText("Reply"));
  return view;
}

test("R4-21: the composer quotes the review being answered, in both arms", async () => {
  fakeFlags({ merchant_reply_suggestions_v1: "control" });
  const view = await openComposer();
  assert.ok(view.findByLabel(/^Review by Mei Ling 1, 2 out of 5: The soup was cold/));
});

test("R4-21: the suggestion chips are a draft test: nobody sees them until it runs", async () => {
  fakeFlags({ merchant_reply_suggestions_v1: "chips" });
  const view = await openComposer();
  assert.equal(view.findByText("Apologise"), null);
});

function runExperiment() {
  const definition = EXPERIMENTS.merchant_reply_suggestions_v1 as { status: string };
  const previous = definition.status;
  definition.status = "running";
  restores.push(() => {
    definition.status = previous;
  });
}

test("R4-21: in the chips arm a chip fills an editable reply and sending counts whether it was edited", async () => {
  runExperiment();
  fakeFlags({ merchant_reply_suggestions_v1: "chips" });
  const sent: string[] = [];
  stub("replyToInteraction", async (_id, text) => {
    sent.push(text);
    return undefined as never;
  });
  const view = await openComposer();
  for (const label of ["Thank", "Apologise", "Invite back"]) assert.ok(view.findByText(label));
  await view.press(view.findByText("Apologise"));
  const field = document.querySelector("textarea") as HTMLTextAreaElement;
  assert.match(field.value, /^Hi Mei, we're sorry/);

  await view.type(view.findByLabel("Your public reply"), `${field.value} Please come back.`);
  await view.press(view.findByText("Send reply"));
  await view.settle();
  assert.equal(sent.length, 1);
  const used = getTrackedAnalyticsEvents().filter(
    (event) => event.event === "merchant_reply_suggestion_used",
  );
  assert.equal(used.length, 1);
  assert.deepEqual(
    { kind: used[0].properties?.kind, edited: used[0].properties?.edited },
    { kind: "apologise", edited: true },
  );
});

test("R4-21: a reply typed from scratch is not counted as a suggestion", async () => {
  runExperiment();
  fakeFlags({ merchant_reply_suggestions_v1: "chips" });
  stub("replyToInteraction", async () => undefined as never);
  const view = await openComposer();
  await view.type(view.findByLabel("Your public reply"), "Thanks for telling us.");
  await view.press(view.findByText("Send reply"));
  await view.settle();
  assert.equal(
    getTrackedAnalyticsEvents().filter((event) => event.event === "merchant_reply_suggestion_used")
      .length,
    0,
  );
});

test("R4-21: editing an existing reply shows no chips", async () => {
  runExperiment();
  fakeFlags({ merchant_reply_suggestions_v1: "chips" });
  stub("getInbox", async () => [
    { ...review(1), reply: { text: "Sorry!", repliedAt: "2026-10-21T00:00:00Z" } },
  ]);
  const view = await renderScreen(CustomerInboxScreen as never, { name: "CustomerInbox" });
  await view.press(view.findByText("Edit reply"));
  assert.equal(view.findByText("Apologise"), null);
});
