// Merchant round-three fixes in a React tree: stale-cache profile save, inbox filter/reply/discard,
// the inline-reply experiment, menu copy and draft pill, missing dish, promotion double-tap.
// Run with `node scripts/test-render.mjs src/app/screens/merchant/merchant-r3.render.test.tsx`.

import assert from "node:assert/strict";
import { act } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { BusinessProfileEditorScreen } from "@/app/screens/merchant/BusinessProfileEditorScreen";
import { CustomerInboxScreen } from "@/app/screens/merchant/CustomerInboxScreen";
import { DishEditorScreen } from "@/app/screens/merchant/DishEditorScreen";
import { MerchantDashboardScreen } from "@/app/screens/merchant/MerchantDashboardScreen";
import { MerchantMenuScreen } from "@/app/screens/merchant/MerchantMenuScreen";
import { MerchantProfileScreen } from "@/app/screens/merchant/MerchantProfileScreen";
import { PromotionBuilderScreen } from "@/app/screens/merchant/PromotionBuilderScreen";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import {
  EXPERIMENTS,
  resetExperimentSession,
  setExperimentFlagSource,
  type ExperimentFlagSource,
} from "@/lib/experiments/experiments";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getActiveOutlet, useMerchantStore } from "@/store/useMerchantStore";
import { cleanup, createFakeNavigation, renderScreen, type RenderResult } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { CustomerInteraction, DishDetail } from "@/types/domain";

const { window } = globalThis as unknown as { window: Window & typeof globalThis };

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

const allByText = (text: string) =>
  (Array.from(document.body.querySelectorAll("*")) as HTMLElement[]).filter(
    (el) =>
      Array.from(el.childNodes)
        .filter((node) => node.nodeType === 3)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim() === text,
  );

// ─── MERCH-2 ────────────────────────────────────────────────────────────────

test("MERCH-2: a stale cached account (no contact details) never saves blank phone and email", async () => {
  const account = useMerchantStore.getState().account!;
  useMerchantStore.setState({
    accountSyncedAt: null,
    account: {
      ...account,
      outlets: account.outlets.map((o) => ({
        ...o,
        contactPhone: undefined,
        contactEmail: undefined,
      })),
    },
  });
  stub("getMerchantAccount", async () => {
    throw new Error("offline");
  });
  const sent: Record<string, unknown>[] = [];
  stub("updateBusinessProfile", async (_id, updates) => {
    sent.push(updates as Record<string, unknown>);
    return { ...getActiveOutlet(useMerchantStore.getState())!, ...updates };
  });

  const view = await renderScreen(BusinessProfileEditorScreen as never, {
    name: "BusinessProfileEditor",
  });
  await view.type(view.findByLabel("Business Name *"), "Uncle Tan Chicken Rice");
  await view.press(view.findByText("Save Profile"));

  assert.equal(sent.length, 1);
  assert.equal(sent[0].name, "Uncle Tan Chicken Rice");
  assert.ok(!("contactPhone" in sent[0]), "untouched phone is not sent");
  assert.ok(!("contactEmail" in sent[0]), "untouched email is not sent");
});

test("MERCH-2: the editor waits for a fresh account and seeds the stored contact", async () => {
  useMerchantStore.setState({ accountSyncedAt: null });
  const fresh = JSON.parse(JSON.stringify(useMerchantStore.getState().account));
  stub("getMerchantAccount", async () => fresh);
  const view = await renderScreen(BusinessProfileEditorScreen as never, {
    name: "BusinessProfileEditor",
  });
  assert.ok(useMerchantStore.getState().accountSyncedAt !== null, "the account was refreshed");
  const phone = (Array.from(document.querySelectorAll("input")) as HTMLInputElement[]).find(
    (input) => input.value === "+6591234567",
  );
  assert.ok(phone, "the stored phone is in the form");
  void view;
});

// ─── Inbox: MERCH-6, MERCH-9, MERCH-24, MERCH-X5 ────────────────────────────

function stubInbox(pages: CustomerInteraction[]) {
  const calls: Parameters<Merchant["getInbox"]>[1][] = [];
  stub("getInbox", async (_id, filters) => {
    calls.push(filters);
    let rows = pages.filter((item) => !filters?.unrepliedOnly || !item.reply);
    if (filters?.before) {
      const index = rows.findIndex((item) => item.id === filters.beforeId);
      rows = rows.slice(index + 1);
    }
    return rows.slice(0, filters?.limit ?? 200);
  });
  stub("replyToInteraction", async () => undefined);
  return calls;
}

test("MERCH-6: Unreplied asks the server, so an all-replied first page is not 'All caught up'", async () => {
  const items = [...Array.from({ length: 30 }, (_, i) => review(i, "Thanks!")), review(30)];
  const calls = stubInbox(items);
  const view = await renderScreen(CustomerInboxScreen as never, {
    name: "CustomerInbox",
    params: { filter: "unreplied" },
  });
  assert.equal(calls[0]?.unrepliedOnly, true);
  assert.match(view.text(), /Reviewer 30/);
  assert.doesNotMatch(view.text(), /All caught up/);
});

test("MERCH-X5: opening the inbox fires merchant_customer_inbox_viewed with the filter", async () => {
  stubInbox([review(1)]);
  await renderScreen(CustomerInboxScreen as never, { name: "CustomerInbox" });
  const viewed = getTrackedAnalyticsEvents().filter(
    (e) => e.event === "merchant_customer_inbox_viewed",
  );
  assert.equal(viewed.length, 1);
  assert.equal(viewed[0].properties.filter, "all");
});

async function openComposerFor(view: RenderResult, index: number) {
  await view.press(allByText("Reply")[index]);
  assert.match(view.text(), /Reply to Reviewer/);
}

test("MERCH-9: a sent reply is patched in place; older pages stay loaded", async () => {
  const calls = stubInbox(Array.from({ length: 60 }, (_, i) => review(i)));
  const view = await renderScreen(CustomerInboxScreen as never, { name: "CustomerInbox" });
  await view.press(view.findByText("Load older reviews"));
  assert.equal(calls.length, 2);
  assert.equal(calls[1]?.beforeId, "review-029", "keyset cursor carries the oldest id");
  assert.match(view.text(), /Reviewer 59/);

  await openComposerFor(view, 35);
  await view.type(document.querySelector("textarea"), "Thank you for visiting!");
  await view.press(view.findByText("Send reply"));

  assert.equal(calls.length, 2, "no refetch back to page 1");
  assert.match(view.text(), /Reviewer 59/);
  assert.match(view.text(), /Thank you for visiting!/);
});

test("MERCH-9/24: closing a typed reply asks first; the field has a real label", async () => {
  stubInbox([review(1)]);
  const view = await renderScreen(CustomerInboxScreen as never, { name: "CustomerInbox" });
  await openComposerFor(view, 0);
  const field = document.querySelector("textarea");
  assert.equal(field?.getAttribute("aria-label"), "Your public reply");
  await view.type(field, "Half a reply");
  await view.press(view.findByLabel("Close reply composer"));
  assert.match(view.text(), /Discard your reply\?/);
  await view.press(view.findByText("Keep editing"));
  assert.equal(document.querySelector("textarea")?.value, "Half a reply");
});

// ─── merchant_inline_reply_v1 ───────────────────────────────────────────────

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

function withStatus(status: "draft" | "running") {
  const definition = EXPERIMENTS.merchant_inline_reply_v1 as { status: string };
  const previous = definition.status;
  definition.status = status;
  restores.push(() => {
    definition.status = previous;
  });
}

async function renderDashboard(unreplied: number) {
  const merchant = getHungryService().merchant;
  const realSummary = merchant.getDashboardSummary.bind(merchant);
  stub("getDashboardSummary", async (id) => ({
    ...(await realSummary(id)),
    unrepliedReviews: unreplied,
  }));
  stub("getInbox", async () => [review(7)]);
  return renderScreen(MerchantDashboardScreen as never, { name: "Dashboard" });
}

test("merchant_inline_reply_v1 is a draft: everyone sees the control card and nobody is exposed", async () => {
  const flags = fakeFlags({ merchant_inline_reply_v1: "inline" });
  const view = await renderDashboard(2);
  assert.match(view.text(), /Unreplied reviews/);
  assert.equal(flags.exposures, 0);
});

test("merchant_inline_reply_v1 inline arm shows the newest unreplied review and opens its reply", async () => {
  withStatus("running");
  const flags = fakeFlags({ merchant_inline_reply_v1: "inline" });
  const view = await renderDashboard(2);
  assert.match(view.text(), /2 reviews are waiting for your reply/);
  assert.match(view.text(), /Review text 7/);
  assert.equal(flags.exposures, 1);
  await view.press(view.findByLabel("Reply to Reviewer 7"));
  const nav = view.navigation.calls.find((call) => call.method === "navigate");
  assert.deepEqual(nav?.args, ["CustomerInbox", { filter: "unreplied", replyToId: "review-007" }]);
});

test("merchant_inline_reply_v1 control arm keeps the count card, which opens the Unreplied filter", async () => {
  withStatus("running");
  fakeFlags({ merchant_inline_reply_v1: "control" });
  const view = await renderDashboard(3);
  assert.doesNotMatch(view.text(), /waiting for your reply/);
  await view.press(view.findByText("Unreplied reviews"));
  const nav = view.navigation.calls.find((call) => call.method === "navigate");
  assert.deepEqual(nav?.args, ["CustomerInbox", { filter: "unreplied" }]);
});

test("merchant_inline_reply_v1 does not expose merchants with nothing to reply to", async () => {
  withStatus("running");
  const flags = fakeFlags({ merchant_inline_reply_v1: "inline" });
  const view = await renderDashboard(0);
  assert.equal(flags.exposures, 0);
  assert.doesNotMatch(view.text(), /waiting for your reply/);
});

test("MERCH-X2: no 'Missing: Contact information' before this session synced the account", async () => {
  const account = useMerchantStore.getState().account!;
  useMerchantStore.setState({
    accountSyncedAt: null,
    account: {
      ...account,
      outlets: account.outlets.map((o) => ({
        ...o,
        contactPhone: undefined,
        contactEmail: undefined,
      })),
    },
  });
  const view = await renderDashboard(0);
  assert.doesNotMatch(view.text(), /Contact information/);
});

// ─── Menu, dish editor, profile, promotion ──────────────────────────────────

test("MERCH-8/17: the menu says Remove from menu and marks draft dishes", async () => {
  const menu = await getHungryService().merchant.getMenu(outletId());
  const draft: DishDetail = {
    ...menu[0],
    id: "draft-dish",
    name: "Draft Laksa",
    isMerchantDraft: true,
  };
  stub("getMenu", async () => [draft]);
  // The menu loads on the stack's focus event: keep the listener and fire it like the stack does.
  const navigation = createFakeNavigation();
  const listeners: (() => void)[] = [];
  (navigation as { addListener: unknown }).addListener = (_event: string, listener: () => void) => {
    listeners.push(listener);
    return () => undefined;
  };
  const view = await renderScreen(MerchantMenuScreen as never, { name: "Menu", navigation });
  await act(async () => {
    listeners.forEach((listener) => listener());
  });
  await view.settle();
  assert.match(view.text(), /Draft Laksa/);
  assert.equal(allByText("Draft").length, 1);
  await view.press(view.findByLabel("Dish options"));
  await view.press(view.findByText("Remove from menu"));
  assert.match(view.text(), /Remove from menu\?/);
  assert.doesNotMatch(view.text(), /Delete Dish/);
});

test("MERCH-13: a dish id that is not on this outlet's menu is not editable", async () => {
  const view = await renderScreen(DishEditorScreen as never, {
    name: "DishEditor",
    params: { dishId: "someone-elses-dish" },
  });
  assert.match(view.text(), /This dish is no longer on your menu/);
  assert.equal(document.querySelectorAll("input").length, 0);
});

test("MERCH-X3: an empty phone falls through to the email on the Profile tab", async () => {
  const outlet = getActiveOutlet(useMerchantStore.getState())!;
  useMerchantStore.getState().updateOutletProfile(outlet.id, {
    contactPhone: "",
    contactEmail: "uncletan@hawker.sg",
  });
  const view = await renderScreen(MerchantProfileScreen as never, { name: "Profile" });
  assert.match(view.text(), /uncletan@hawker\.sg/);
});

test("MERCH-11/4: Publish twice in one frame creates one promotion; a past end date is refused", async () => {
  let created = 0;
  stub("createPromotion", async (_id, promo) => {
    created += 1;
    return { ...promo, id: `promo-${created}`, outletId: outletId(), createdAt: "" } as never;
  });
  const view = await renderScreen(PromotionBuilderScreen as never, { name: "PromotionBuilder" });
  await view.type(view.findByLabel("Promotion Title *"), "Lunch deal");
  await view.type(view.findByLabel("Description *"), "Free drink with any noodle");

  const publish = view.findByText("Publish now")!;
  await act(async () => {
    publish.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    publish.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await view.settle();
  assert.equal(created, 1);

  await cleanup();
  const again = await renderScreen(PromotionBuilderScreen as never, { name: "PromotionBuilder" });
  await again.type(again.findByLabel("Promotion Title *"), "Old deal");
  await again.type(again.findByLabel("Description *"), "Already over");
  await again.type(again.findByLabel("Start Date"), "2020-01-01");
  await again.type(again.findByLabel("End Date"), "2020-01-02");
  await again.press(again.findByText("Publish now"));
  assert.match(again.text(), /end date has passed/);
  assert.equal(created, 1);
});
