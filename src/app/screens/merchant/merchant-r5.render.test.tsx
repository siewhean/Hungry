// Merchant round five in a React tree: symbols instead of text glyphs, the press scale, tag chips,
// the Performance chart with last period's bars and a tap to read a bar, the 24-hour peak strip,
// the contact number, Sign out as a confirmed text row, and the toast above the tab bar.
// Run with `node scripts/test-render.mjs src/app/screens/merchant/merchant-r5.render.test.tsx`.

import assert from "node:assert/strict";
import { Star } from "lucide-react-native";
import { act, createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { CustomerInboxScreen } from "@/app/screens/merchant/CustomerInboxScreen";
import { MerchantAnalyticsScreen } from "@/app/screens/merchant/MerchantAnalyticsScreen";
import { MerchantMenuScreen } from "@/app/screens/merchant/MerchantMenuScreen";
import { MerchantProfileScreen } from "@/app/screens/merchant/MerchantProfileScreen";
import { DailyBarChart } from "@/components/merchant/DailyBarChart";
import { PeakHoursChart } from "@/components/merchant/PeakHoursChart";
import { TagChipsInput } from "@/components/merchant/TagChipsInput";
import { AppSymbol, FloatingToast, PressableScale } from "@/components/ui";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getActiveOutlet, useMerchantStore } from "@/store/useMerchantStore";
import { resetHapticThrottle } from "@/lib/haptics";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, createFakeNavigation, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { DishDetail, MerchantDailyPoint } from "@/types/domain";

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
  useUIStore.setState({ toast: null });
  useMerchantStore.setState({ analyticsRange: null });
});

function day(date: string, profileVisits: number): MerchantDailyPoint {
  return { date, profileVisits, menuViews: 0, dishViews: 0, directionTaps: 0, saves: 0 };
}

// ─── R5-2: AppSymbol ────────────────────────────────────────────────────────

test("R5-2: a decorative symbol is hidden from screen readers, a meaningful one is read out", async () => {
  const view = await render(
    createElement(
      "div",
      null,
      createElement(AppSymbol, {
        name: "star.fill",
        fallback: Star,
        color: "#000",
        testID: "plain",
      }),
      createElement(AppSymbol, {
        name: "star.fill",
        fallback: Star,
        color: "#000",
        accessibilityLabel: "Rated 4 out of 5",
        testID: "named",
      }),
    ),
  );
  const plain = view.findByTestId("plain") as HTMLElement;
  assert.equal(plain.getAttribute("aria-hidden"), "true");
  assert.equal(plain.getAttribute("aria-label"), null);
  const named = view.findByLabel("Rated 4 out of 5") as HTMLElement;
  assert.equal(named.getAttribute("role"), "img");
  assert.notEqual(named.getAttribute("aria-hidden"), "true");
  // Off iOS the Lucide icon is drawn, in the size asked for.
  assert.ok(plain.querySelector('[data-stub="lucide-react-native.Star"]'));
  assert.equal((plain as HTMLElement).style.width, "16px");
});

// ─── R5-4: PressableScale ───────────────────────────────────────────────────

test("R5-4: PressableScale presses like a button and does nothing when disabled", async () => {
  let presses = 0;
  const view = await render(
    createElement(
      "div",
      null,
      createElement(PressableScale, {
        accessibilityRole: "button",
        accessibilityLabel: "Open",
        onPress: () => {
          presses += 1;
        },
      }),
      createElement(PressableScale, {
        accessibilityRole: "button",
        accessibilityLabel: "Locked",
        disabled: true,
        onPress: () => {
          presses += 10;
        },
      }),
    ),
  );
  await view.press(view.findByLabel("Open"));
  await view.press(view.findByLabel("Locked"));
  assert.equal(presses, 1);
});

// ─── R5-3: toast ────────────────────────────────────────────────────────────

test("R5-3: the toast is lifted above the tab bar", async () => {
  useUIStore.getState().showToast({ message: "Merchant mode", tone: "success" });
  const view = await render(createElement(FloatingToast));
  assert.match(view.text(), /Merchant mode/);
  let wrapper = view.findByText("Merchant mode");
  while (wrapper && !wrapper.style.bottom) wrapper = wrapper.parentElement;
  const bottom = Number.parseFloat(wrapper?.style.bottom ?? "");
  assert.ok(bottom >= 62, `bottom is ${bottom}, the tab bar is 62 tall`);
});

// ─── R5-10: tag chips ───────────────────────────────────────────────────────

test("R5-10: tags are chips: a comma adds one, a chip removes it, a suggestion adds it", async () => {
  let tags: string[] = ["spicy"];
  const props = () => ({
    tags,
    onChange: (next: string[]) => {
      tags = next;
    },
    suggestions: ["spicy", "creamy", "sour"],
  });
  const view = await render(createElement(TagChipsInput, props()));
  assert.ok(view.findByLabel("Remove spicy"));
  assert.equal(view.findByLabel("Add spicy"), null, "a tag already added is not suggested again");

  await view.type(view.findByLabel("Add a tag"), "springy noodles,");
  assert.deepEqual(tags, ["spicy", "springy noodles"]);

  await view.rerender(createElement(TagChipsInput, props()));
  await view.press(view.findByLabel("Add creamy"));
  assert.deepEqual(tags, ["spicy", "springy noodles", "creamy"]);

  await view.rerender(createElement(TagChipsInput, props()));
  await view.press(view.findByLabel("Remove spicy"));
  assert.deepEqual(tags, ["springy noodles", "creamy"]);
});

// ─── R5-7: charts ───────────────────────────────────────────────────────────

test("R5-7: the chart draws last period's days behind this period's and a tap reads a bar", async () => {
  const now = [day("2026-10-27", 4), day("2026-10-28", 8)];
  const before = [day("2026-10-20", 16), day("2026-10-21", 2)];
  const view = await render(createElement(DailyBarChart, { series: now, previous: before }));
  assert.equal(document.querySelectorAll('[data-testid^="daily-bar-"]').length, 2);
  assert.equal(document.querySelectorAll('[data-testid^="daily-prev-"]').length, 2);
  assert.match(view.text(), /Grey bars are the same days in the period before/);
  assert.match(view.text(), /Busiest day: Wed 28 Oct with 8/);

  await view.press(view.findByLabel(/Tue 27 Oct: 4 profile visits/));
  assert.match(view.text(), /Tue 27 Oct: 4 profile visits\. 16 on the same day before/);
  await view.press(view.findByLabel(/Tue 27 Oct: 4 profile visits/));
  assert.match(view.text(), /Busiest day/, "a second tap lets go of the bar");
});

test("R5-7: without a previous period the chart has no grey bars or legend", async () => {
  const view = await render(createElement(DailyBarChart, { series: [day("2026-10-27", 4)] }));
  assert.equal(document.querySelectorAll('[data-testid^="daily-prev-"]').length, 0);
  assert.doesNotMatch(view.text(), /Grey bars/);
});

test("R5-7: peak hours are drawn across 24 hours with the busiest filled in", async () => {
  const view = await render(createElement(PeakHoursChart, { peakHours: [13, 12] }));
  assert.equal(document.querySelectorAll('[data-testid^="peak-hour-"]').length, 24);
  assert.match(view.text(), /Busiest first: 1 PM, 12 PM/);
  assert.ok(view.findByLabel(/Busiest hours of the day\. Busiest first: 1 PM, 12 PM/));
  const tall = (hour: number) =>
    Number.parseFloat(
      (document.querySelector(`[data-testid="peak-hour-${hour}"]`) as HTMLElement).style.height,
    );
  assert.ok(tall(13) > tall(14) && tall(12) > tall(11));
  const empty = await render(createElement(PeakHoursChart, { peakHours: [] }));
  assert.match(empty.text(), /No peak-hour data yet/);
});

test("R5-7: Performance asks for the previous period too, and survives it failing", async () => {
  const asked: (string | undefined)[] = [];
  const original = getHungryService().merchant.getDailySeries.bind(getHungryService().merchant);
  stub("getDailySeries", async (id, range, period) => {
    asked.push(period);
    if (period === "previous") throw new Error("down");
    return original(id, range, period);
  });
  const view = await renderScreen(MerchantAnalyticsScreen as never, { name: "Analytics" });
  await view.settle();
  assert.deepEqual([...asked].sort(), ["current", "previous"]);
  assert.equal(document.querySelectorAll('[data-testid^="daily-bar-"]').length, 7);
  assert.equal(document.querySelectorAll('[data-testid^="daily-prev-"]').length, 0);
});

test("R5-2: Performance tiles say up or down in words, with the star after a rating change", async () => {
  const originalAnalytics = getHungryService().merchant.getAnalytics;
  stub("getAnalytics", async (id, range) => {
    const base = await originalAnalytics.call(getHungryService().merchant, id, range);
    return {
      ...base,
      averageRating: 4.5,
      reviewCount: 4,
      profileVisits: 120,
      previousPeriodComparison: {
        ...base.previousPeriodComparison,
        averageRating: 4.9,
        reviewCount: 4,
        profileVisits: 100,
      },
    };
  });
  const view = await renderScreen(MerchantAnalyticsScreen as never, { name: "Analytics" });
  await view.settle();
  assert.ok(view.findByLabel("up 20%"), "visits are up 20%");
  assert.ok(view.findByLabel("down 0.4 stars"), "the rating is down 0.4 stars");
  assert.doesNotMatch(view.text(), /[★▲▼]/);
});

// ─── R5-2 / R5-12 / R5-13 / R5-8: inbox, profile ────────────────────────────

test("R5-2: the inbox rating chips are numbers with a star symbol, read as stars", async () => {
  const view = await renderScreen(CustomerInboxScreen as never, { name: "CustomerInbox" });
  await view.settle();
  for (const label of ["1 to 2 stars", "3 stars", "4 to 5 stars"]) {
    assert.ok(view.findByLabel(label), label);
  }
  assert.doesNotMatch(view.text(), /★/);
});

test("R5-12: the contact number shows as +65 9123 4567", async () => {
  const outlet = getActiveOutlet(useMerchantStore.getState());
  assert.ok(outlet);
  useMerchantStore.getState().updateOutletProfile(outlet.id, { contactPhone: "+6591234567" });
  const view = await renderScreen(MerchantProfileScreen as never, { name: "MerchantProfile" });
  assert.match(view.text(), /\+65 9123 4567/);
});

test("R5-13: Sign out is a text row that asks before it signs out", async () => {
  const view = await renderScreen(MerchantProfileScreen as never, { name: "MerchantProfile" });
  assert.ok(view.findByText("Switch to customer mode"));
  assert.equal(view.findByText("Switch to Customer Mode"), null);
  await view.press(view.findByLabel("Sign out"));
  assert.match(view.text(), /Sign out\?/);
  assert.match(view.text(), /You will need to sign in again/);
  await view.press(view.findByText("Cancel"));
  assert.doesNotMatch(view.text(), /You will need to sign in again/);
});

// ─── R5-5 / R5-11: menu ─────────────────────────────────────────────────────

test("R5-11: the menu note is an information note with a symbol, not a green success box", async () => {
  stub("getMenu", async () => []);
  const view = await renderScreen(MerchantMenuScreen as never, { name: "MerchantMenu" });
  await view.settle();
  const note = view.findByText(/Changes you make here|Dishes you add are saved as drafts/);
  assert.ok(note);
  assert.ok(
    note.parentElement?.querySelector('[data-stub="lucide-react-native.Info"]'),
    "the note carries the info symbol",
  );
});

// ─── R5-4: haptics ──────────────────────────────────────────────────────────

test("R5-4: flipping the sold-out switch gives one selection tick", async () => {
  const ticks: string[] = [];
  const haptics = require("expo-haptics") as Record<string, unknown>;
  const original = haptics.selectionAsync;
  haptics.selectionAsync = async () => {
    ticks.push("select");
  };
  restores.push(() => {
    haptics.selectionAsync = original;
  });
  resetHapticThrottle();

  const base = (
    await getHungryService().merchant.getMenu(getActiveOutlet(useMerchantStore.getState())!.id)
  )[0];
  stub("getMenu", async () => [
    { ...base, id: "d1", name: "Laksa", availabilityFlags: [], dietaryFlags: [] } as DishDetail,
  ]);
  stub("toggleSoldOut", async () => true);
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

  const toggle = view.findByLabel("Laksa available") as HTMLInputElement;
  assert.ok(toggle, "the availability switch is on the row");
  await act(async () => {
    toggle.click();
  });
  await view.settle();
  assert.deepEqual(ticks, ["select"]);
});
