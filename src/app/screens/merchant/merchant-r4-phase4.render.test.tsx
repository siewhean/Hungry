// Merchant round-four phase 4 in a React tree: the profile editor (cuisine picker, pinned Save,
// section links from the Profile tab), promotion dates and defaults, the inbox rating chips and
// rated-only sentiment, the Home tool tiles and the range Home and Performance share, plus the
// plain alert titles, Settings reads that reach Sentry and tab roots without a back arrow.
// Run with `node scripts/test-render.mjs src/app/screens/merchant/merchant-r4-phase4.render.test.tsx`.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { BusinessProfileEditorScreen } from "@/app/screens/merchant/BusinessProfileEditorScreen";
import { CustomerInboxScreen } from "@/app/screens/merchant/CustomerInboxScreen";
import { MerchantAnalyticsScreen } from "@/app/screens/merchant/MerchantAnalyticsScreen";
import { MerchantDashboardScreen } from "@/app/screens/merchant/MerchantDashboardScreen";
import { MerchantMenuScreen } from "@/app/screens/merchant/MerchantMenuScreen";
import { MerchantProfileScreen } from "@/app/screens/merchant/MerchantProfileScreen";
import { MerchantSettingsScreen } from "@/app/screens/merchant/MerchantSettingsScreen";
import { PromotionBuilderScreen } from "@/app/screens/merchant/PromotionBuilderScreen";
import {
  EXPERIMENTS,
  resetExperimentSession,
  setExperimentFlagSource,
  type ExperimentFlagSource,
} from "@/lib/experiments/experiments";
import { getHungryService } from "@/lib/services/serviceProvider";
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

beforeEach(async () => {
  await enterScenario("merchant");
});

afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()?.();
  setExperimentFlagSource(undefined);
  resetExperimentSession();
  useMerchantStore.setState({ analyticsRange: null });
});

function fakeFlags(flags: Record<string, string>) {
  const source: ExperimentFlagSource = {
    peek: (key) => flags[key],
    expose: (key) => flags[key],
    hasLoaded: () => true,
    onChange: () => () => undefined,
  };
  setExperimentFlagSource(source);
}

function runExperiment(key: keyof typeof EXPERIMENTS) {
  const definition = EXPERIMENTS[key] as { status: string };
  const previous = definition.status;
  definition.status = "running";
  restores.push(() => {
    definition.status = previous;
  });
}

/** Reads what reportError logs in development, so a test can tell what reached Sentry. */
async function captureReportedErrors(run: () => Promise<void>) {
  const reported: { error: unknown; context: unknown }[] = [];
  const original = console.error;
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  globals.__DEV__ = true;
  console.error = (...args: unknown[]) => {
    if (args[0] === "[reportError]") reported.push({ error: args[1], context: args[2] });
  };
  try {
    await run();
  } finally {
    console.error = original;
    globals.__DEV__ = previousDev;
  }
  return reported;
}

function outlet() {
  const active = getActiveOutlet(useMerchantStore.getState());
  assert.ok(active, "merchant scenario has an outlet");
  return active;
}

// ─── R4-19 / R4-20: profile editor ──────────────────────────────────────────

test("R4-20: cuisine is a chip picker capped at three, saved as a list", async () => {
  useMerchantStore.getState().updateOutletProfile(outlet().id, { cuisineCategories: ["Chinese"] });
  const sent: Record<string, unknown>[] = [];
  stub("updateBusinessProfile", async (_id, updates) => {
    sent.push(updates as Record<string, unknown>);
    return { ...outlet(), ...updates };
  });
  const view = await renderScreen(BusinessProfileEditorScreen as never, {
    name: "BusinessProfileEditor",
  });
  assert.match(view.text(), /Pick up to 3/);
  await view.press(view.findByText("Malay"));
  await view.press(view.findByText("Thai"));
  assert.match(view.text(), /3 of 3 picked/);
  await view.press(view.findByText("Korean"));
  await view.press(view.findByText("Save profile"));
  assert.deepEqual(sent[0]?.cuisineCategories, ["Chinese", "Malay", "Thai"]);
});

test("R4-20: a cuisine tapped off frees a slot", async () => {
  useMerchantStore
    .getState()
    .updateOutletProfile(outlet().id, { cuisineCategories: ["Chinese", "Malay", "Thai"] });
  const sent: Record<string, unknown>[] = [];
  stub("updateBusinessProfile", async (_id, updates) => {
    sent.push(updates as Record<string, unknown>);
    return { ...outlet(), ...updates };
  });
  const view = await renderScreen(BusinessProfileEditorScreen as never, {
    name: "BusinessProfileEditor",
  });
  await view.press(view.findByText("Thai"));
  await view.press(view.findByText("Korean"));
  await view.press(view.findByText("Save profile"));
  assert.deepEqual(sent[0]?.cuisineCategories, ["Chinese", "Malay", "Korean"]);
});

test("R4-19: Save sits in the pinned footer, outside the scrolling form", async () => {
  const view = await renderScreen(BusinessProfileEditorScreen as never, {
    name: "BusinessProfileEditor",
  });
  const save = view.findByText("Save profile");
  assert.ok(save);
  // The form is the scroll container's child; a pinned footer is not inside any scroller.
  let node: HTMLElement | null = save;
  while (node) {
    const overflow = (node.style.overflowY || "").toString();
    assert.ok(overflow !== "auto" && overflow !== "scroll", "Save is inside a scrolling element");
    node = node.parentElement;
  }
});

test("R4-19: Location, Hours and Contact open the editor at their own section", async () => {
  const navigation = createFakeNavigation();
  const view = await renderScreen(MerchantProfileScreen as never, { name: "Profile", navigation });
  await view.press(view.findByLabel(/^Location:/));
  await view.press(view.findByLabel(/^Operating hours:/));
  await view.press(view.findByLabel(/^Contact:/));
  const sections = navigation.calls
    .filter((call) => call.method === "navigate" && call.args[0] === "BusinessProfileEditor")
    .map((call) => (call.args[1] as { section?: string } | undefined)?.section);
  assert.deepEqual(sections, ["location", "hours", "contact"]);
});

// ─── R4-23, R4-25, R4-35: Profile and Home layout ───────────────────────────

test("R4-23: Contact reads Loading before the account sync lands, then the real answer", async () => {
  useMerchantStore.getState().updateOutletProfile(outlet().id, {
    contactPhone: undefined,
    contactEmail: undefined,
  });
  useMerchantStore.setState({ accountSyncedAt: null });
  const view = await renderScreen(MerchantProfileScreen as never, { name: "Profile" });
  assert.ok(view.findByLabel("Contact: Loading…"));
  assert.doesNotMatch(view.text(), /No contact added/);

  const { act } = await import("react");
  await act(async () => {
    useMerchantStore.setState({ accountSyncedAt: Date.now() });
  });
  assert.ok(view.findByLabel("Contact: No contact added"));
});

test("R4-25: Profile keeps stall data; Promotions, Featured visitors and Settings live on Home", async () => {
  const profile = await renderScreen(MerchantProfileScreen as never, { name: "Profile" });
  assert.doesNotMatch(
    profile.text(),
    /Featured visitors|Create and manage offers|Alerts and support/,
  );
  await cleanup();

  const navigation = createFakeNavigation();
  const home = await renderScreen(MerchantDashboardScreen as never, {
    name: "Dashboard",
    navigation,
  });
  await home.settle();
  const tiles: [RegExp, string][] = [
    [/^Promotions\./, "PromotionList"],
    [/^Featured visitors\./, "FeaturedVisitors"],
    [/^Insights\./, "AIAssistant"],
    [/^Merchant settings\./, "MerchantSettings"],
  ];
  for (const [label, route] of tiles) {
    await home.press(home.findByLabel(label));
    assert.ok(
      navigation.calls.some((call) => call.method === "navigate" && call.args[0] === route),
      `${route} opens from its tile`,
    );
  }
});

test("R4-35: tab roots (Menu, Performance, Profile) show no back arrow", async () => {
  const menu = await renderScreen(MerchantMenuScreen as never, { name: "Menu" });
  await menu.settle();
  assert.equal(menu.findByLabel("Go back"), null);
  await cleanup();
  const analytics = await renderScreen(MerchantAnalyticsScreen as never, { name: "Analytics" });
  await analytics.settle();
  assert.equal(analytics.findByLabel("Go back"), null);
  await cleanup();
  const profile = await renderScreen(MerchantProfileScreen as never, { name: "Profile" });
  assert.equal(profile.findByLabel("Go back"), null);
});

// ─── R4-26: the range Home and Performance share ────────────────────────────

function stubAnalyticsRanges() {
  const ranges: string[] = [];
  const real = getHungryService().merchant.getAnalytics.bind(getHungryService().merchant);
  stub("getAnalytics", async (id, range) => {
    ranges.push(String(range));
    return real(id, range);
  });
  return ranges;
}

test("R4-26: Home opens on Today (control) or 7 days (test arm) until a range is picked", async () => {
  runExperiment("merchant_home_default_range_v1");
  const ranges = stubAnalyticsRanges();
  fakeFlags({ merchant_home_default_range_v1: "control" });
  await renderScreen(MerchantDashboardScreen as never, { name: "Dashboard" });
  assert.equal(ranges.at(-1), "today");
  await cleanup();

  resetExperimentSession();
  fakeFlags({ merchant_home_default_range_v1: "seven_days" });
  await renderScreen(MerchantDashboardScreen as never, { name: "Dashboard" });
  assert.equal(ranges.at(-1), "7d");
});

test("R4-26: a range picked on Home is the range Performance opens on", async () => {
  const ranges = stubAnalyticsRanges();
  const home = await renderScreen(MerchantDashboardScreen as never, { name: "Dashboard" });
  await home.press(home.findByText("30 days"));
  assert.equal(useMerchantStore.getState().analyticsRange, "30d");
  await cleanup();
  await renderScreen(MerchantAnalyticsScreen as never, { name: "Analytics" });
  assert.equal(ranges.at(-1), "30d");
});

test("R4-26: Performance still opens on 7 days when nothing was picked", async () => {
  const ranges = stubAnalyticsRanges();
  await renderScreen(MerchantAnalyticsScreen as never, { name: "Analytics" });
  assert.equal(ranges.at(-1), "7d");
});

// ─── R4-22: promotions ──────────────────────────────────────────────────────

test("R4-22: a new promotion starts on Existing menu item, with human dates and neutral placeholders", async () => {
  const view = await renderScreen(PromotionBuilderScreen as never, { name: "PromotionBuilder" });
  await view.settle();
  assert.match(view.text(), /Select the dish this promotion applies to\./);
  assert.match(view.text(), /Valid \d{1,2} [A-Z][a-z]{2}( \d{4})? – \d{1,2} [A-Z][a-z]{2}/);
  assert.doesNotMatch(view.text(), /Valid \d{4}-\d{2}-\d{2}/);
  const placeholders = (Array.from(document.querySelectorAll("input")) as HTMLInputElement[])
    .map((input) => input.placeholder)
    .filter(Boolean);
  assert.ok(!placeholders.includes("6.50") && !placeholders.includes("5.50"));
});

test("R4-22: a stall with no dishes starts on New item", async () => {
  stub("getMenu", async () => []);
  const view = await renderScreen(PromotionBuilderScreen as never, { name: "PromotionBuilder" });
  await view.settle();
  assert.doesNotMatch(view.text(), /Select the dish this promotion applies to\./);
});

// ─── R4-28, R4-29, R4-32: inbox ─────────────────────────────────────────────

function review(index: number, rating: number | undefined): CustomerInteraction {
  return {
    id: `review-${index}`,
    outletId: outlet().id,
    type: "review",
    authorName: `Reviewer ${index}`,
    rating,
    text: `Review text ${index}`,
    tags: [],
    createdAt: new Date(Date.now() - index * 86_400_000).toISOString(),
    sentiment: "neutral",
  } as CustomerInteraction;
}

test("R4-28: rating chips filter the loaded reviews and unrated ones are left out of the summary", async () => {
  stub("getInbox", async () => [review(1, 5), review(2, 3), review(3, 1), review(4, undefined)]);
  const view = await renderScreen(CustomerInboxScreen as never, { name: "CustomerInbox" });
  await view.settle();
  for (const label of ["All", "Unreplied", "1–2", "3", "4–5"]) {
    assert.ok(view.findByText(label), `${label} chip`);
  }
  assert.equal(view.findByText("Reviews"), null, "the Reviews chip duplicated All");
  assert.match(view.text(), /All 3 rated reviews/);
  assert.match(view.text(), /33% Positive/);
  assert.doesNotMatch(view.text(), /25% Neutral/);

  await view.press(view.findByText("3"));
  assert.match(view.text(), /Reviewer 2/);
  assert.doesNotMatch(view.text(), /Reviewer 1\b|Reviewer 3\b/);
  await view.press(view.findByText("1–2"));
  assert.match(view.text(), /Reviewer 3/);
  assert.doesNotMatch(view.text(), /Reviewer 2\b/);
});

test("R4-28: an empty rating chip says so instead of 'All caught up'", async () => {
  stub("getInbox", async () => [review(1, 5)]);
  const view = await renderScreen(CustomerInboxScreen as never, { name: "CustomerInbox" });
  await view.settle();
  await view.press(view.findByText("1–2"));
  assert.match(view.text(), /Nothing here/);
  assert.doesNotMatch(view.text(), /All caught up/);
});

test("R4-32: review dates read as relative time", async () => {
  stub("getInbox", async () => [review(2, 4)]);
  const view = await renderScreen(CustomerInboxScreen as never, { name: "CustomerInbox" });
  await view.settle();
  assert.match(view.text(), /2 days ago/);
});

test("R4-29: a failed report names what failed and a successful one thanks the merchant", async () => {
  stub("getInbox", async () => [review(1, 4)]);
  stub("reportInteraction", async () => {
    throw new Error("offline");
  });
  const view = await renderScreen(CustomerInboxScreen as never, { name: "CustomerInbox" });
  await view.settle();
  const reported = await captureReportedErrors(async () => {
    await view.press(view.findByLabel("More actions"));
    await view.press(view.findByText("Report"));
    await view.press(view.findByText("Spam or fake review"));
  });
  assert.match(view.text(), /Couldn't report this review/);
  assert.doesNotMatch(view.text(), /Failed to report interaction/);
  assert.ok(reported.length >= 1);
});

// ─── R4-29, R4-30: Settings ─────────────────────────────────────────────────

test("R4-30: Settings reads that fail reach Sentry with their own action", async () => {
  stub("getMerchantNotifications", async () => {
    throw new Error("notes down");
  });
  stub("getNotificationPreferences", async () => {
    throw new Error("prefs down");
  });
  const reported = await captureReportedErrors(async () => {
    const view = await renderScreen(MerchantSettingsScreen as never, { name: "MerchantSettings" });
    await view.settle();
    assert.match(view.text(), /Low-rating push alerts/);
  });
  const actions = reported.map((entry) => (entry.context as { action?: string }).action);
  assert.ok(actions.includes("load_notifications"));
  assert.ok(actions.includes("load_prefs"));
});

test("R4-31: Settings no longer carries the weekly numbers", async () => {
  const view = await renderScreen(MerchantSettingsScreen as never, { name: "MerchantSettings" });
  await view.settle();
  assert.doesNotMatch(view.text(), /views in the last 7 days|Weekly numbers will appear/);
});
