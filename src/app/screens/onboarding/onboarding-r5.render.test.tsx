// Round-five onboarding fixes (F1 to F8 of onboarding-final-audit), checked in a rendered tree
// (react-native-web + jsdom, mock data). Run with
// `node scripts/test-render.mjs src/app/screens/onboarding/onboarding-r5.render.test.tsx`.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { afterEach, beforeEach } from "node:test";
import { createElement } from "react";

import { AppSymbol } from "@/components/ui";
import { staggerDelay } from "@/lib/motion/uiMotion";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useOnboardingDraftStore } from "@/store/useOnboardingDraftStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { DishDetail } from "@/types/domain";
import { FoodOpennessScreen } from "./FoodOpennessScreen";
import { LocationPermissionScreen } from "./LocationPermissionScreen";
import { OnboardingHeader } from "./OnboardingHeader";
import { ResultDishCard } from "./ResultDishCard";
import { TasteOptionTiles } from "./TasteOptionTiles";
import { TASTE_QUESTION_FOODS } from "./onboardingFoodImages";
import { TasteProfileResultScreen } from "./TasteProfileResultScreen";
import { WelcomeScreen } from "./WelcomeScreen";

beforeEach(async () => {
  await enterScenario("guest");
  useSessionStore.setState({ isAuthenticated: false, hasCompletedOnboarding: false });
  useOnboardingDraftStore.getState().clearDraft();
  useUIStore.setState({ reducedMotionEnabled: true });
});

afterEach(async () => {
  await cleanup();
});

const services = () =>
  require("@/lib/services/serviceProvider") as typeof import("@/lib/services/serviceProvider");

// A supabase-mode provider whose server calls are the ones a test passes in.
function useSupabaseProvider(overrides: {
  getSlate: (request: unknown) => Promise<unknown>;
  listPopularNearby?: (...args: unknown[]) => Promise<DishDetail[]>;
}) {
  const { getServiceProvider, setServiceProvider } = services();
  const provider = getServiceProvider();
  setServiceProvider({
    ...provider,
    mode: "supabase",
    service: {
      ...provider.service,
      recommendations: {
        ...provider.service.recommendations,
        getSlate: overrides.getSlate as never,
      },
      discovery: {
        ...provider.service.discovery,
        ...(overrides.listPopularNearby
          ? { listPopularNearby: overrides.listPopularNearby as never }
          : {}),
      },
    },
  });
}

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

test("F1: Welcome draws its three value rows with symbols, not emoji", async () => {
  const view = await renderScreen(WelcomeScreen as never, { name: "OnboardingWelcome" });
  assert.ok(view.findByText("Ranked by people who ate it"));
  assert.ok(view.findByText("Find the best hawker stalls near you"));
  assert.ok(view.findByText("Personalised to your taste"));
  assert.doesNotMatch(view.text(), EMOJI, "no emoji anywhere on Welcome");
  // Off iOS the lucide icon of the same meaning is drawn (the stub marks it).
  assert.equal(
    view.container.querySelectorAll('[data-stub="lucide-react-native.MapPin"]').length,
    1,
  );
});

test("F1: AppSymbol is decorative and picks the lucide icon off iOS", async () => {
  const view = await render(createElement(AppSymbol, { name: "yourTaste", color: "#000" }));
  assert.equal(
    view.container.querySelectorAll('[data-stub="lucide-react-native.SlidersHorizontal"]').length,
    1,
  );
});

test("F2: a failed server read shows the error and Try again, not an empty result", async () => {
  useSupabaseProvider({
    getSlate: async () => {
      throw new Error("offline");
    },
    listPopularNearby: async () => {
      throw new Error("must not be reached");
    },
  });
  const view = await renderScreen(TasteProfileResultScreen as never, {
    name: "TasteProfileResult",
  });
  await view.settle();
  assert.ok(view.findByText("Try again"));
  assert.ok(view.findByText("We couldn't load your picks."));
  assert.equal(view.findByText("Dishes that match your taste will show up here."), null);
});

test("F2: the popular top-up never falls back to the catalog download, and Try again recovers", async () => {
  const popularCalls: unknown[][] = [];
  const dishes = getDataRepository().listPopularNearby().slice(0, 4);
  let healthy = false;
  useSupabaseProvider({
    getSlate: async () => ({ items: [] }),
    listPopularNearby: async (...args) => {
      popularCalls.push(args);
      if (!healthy) throw new Error("popular failed");
      return dishes;
    },
  });
  const view = await renderScreen(TasteProfileResultScreen as never, {
    name: "TasteProfileResult",
  });
  await view.settle();
  assert.deepEqual(popularCalls[0], [undefined, undefined, { noCatalogFallback: true }]);
  assert.ok(view.findByText("Try again"), "an outage shows the error state");

  healthy = true;
  await view.press(view.findByText("Try again"));
  await view.settle();
  assert.equal(view.findByText("Try again"), null);
  assert.ok(view.findByText(dishes[0]!.name), "the retry shows the popular dishes");
});

test("F2: taste matches already loaded are kept when only the popular top-up fails", async () => {
  const dishes = getDataRepository().listPopularNearby().slice(0, 2);
  useSupabaseProvider({
    getSlate: async () => ({ items: dishes.map((dish) => ({ dish })) }),
    listPopularNearby: async () => {
      throw new Error("popular failed");
    },
  });
  const view = await renderScreen(TasteProfileResultScreen as never, {
    name: "TasteProfileResult",
  });
  await view.settle();
  assert.equal(view.findByText("Try again"), null);
  assert.ok(view.findByText(dishes[0]!.name));
});

test("F4: every onboarding step uses the same left-aligned heading", async () => {
  const titles = [
    ["OnboardingHeader", createElement(OnboardingHeader, { title: "A title", subtitle: "A line" })],
  ] as const;
  const header = await render(titles[0][1]);
  const own = header.findByText("A title")!;
  assert.notEqual(own.style.textAlign, "center");

  const screens = [
    [LocationPermissionScreen, "LocationPermission", "Discover the best bites around you."],
    [FoodOpennessScreen, "FoodOpenness", "How open are you to trying new food?"],
    [TasteProfileResultScreen, "TasteProfileResult", "Your first picks"],
  ] as const;
  const sizes = new Set<string>();
  for (const [Screen, name, title] of screens) {
    const view = await renderScreen(Screen as never, { name, params: { mode: "onboarding" } });
    const heading = view.findByText(title);
    assert.ok(heading, `${name} shows its title`);
    assert.notEqual(heading!.style.textAlign, "center", `${name} heading is left-aligned`);
    sizes.add(heading!.style.fontSize);
    await cleanup();
  }
  assert.equal(sizes.size, 1, "one heading size across steps");
});

test("F5: a long dish name gets two lines, and F3: a photo-less laksa shows a labelled example", async () => {
  const dish = {
    id: "d1",
    name: "Chicken Satay (10 sticks) with peanut sauce",
    venueName: "Satay Stall",
    imageUrl: "",
    tasteTags: ["smoky"],
    foodTypeTag: "Satay",
  } as unknown as DishDetail;
  const view = await render(
    createElement(ResultDishCard, {
      dish,
      details: true,
      popular: false,
      isSaved: false,
      openLabel: "Preview",
      onToggleSave: () => undefined,
    }),
  );
  const name = view.findByText(dish.name)!;
  assert.match(name.style.cssText, /-webkit-line-clamp:\s*2/, "the name wraps to two lines");
  assert.equal(view.container.querySelectorAll('[data-stub="expo-image.Image"]').length, 1);
  assert.ok(view.findByText("Example photo"));
  assert.equal(view.findByLabel(/no photo yet/), null);
});

test("F3: a dish with no matching example keeps the plain tile", async () => {
  const dish = {
    id: "d2",
    name: "Hokkien Mee",
    venueName: "Mee Stall",
    imageUrl: "",
    tasteTags: [],
  } as unknown as DishDetail;
  const view = await render(
    createElement(ResultDishCard, {
      dish,
      details: true,
      popular: false,
      isSaved: false,
      openLabel: "Preview",
      onToggleSave: () => undefined,
    }),
  );
  assert.ok(view.findByLabel("Hokkien Mee, no photo yet"));
  assert.equal(view.findByText("Example photo"), null);
});

test("F6: the price is set in the body face with tabular figures", async () => {
  const dish = {
    id: "d3",
    name: "Chicken Rice",
    venueName: "Rice Stall",
    imageUrl: "",
    tasteTags: [],
    price: 5.5,
  } as unknown as DishDetail;
  const view = await render(
    createElement(ResultDishCard, {
      dish,
      details: true,
      popular: false,
      isSaved: false,
      openLabel: "Preview",
      onToggleSave: () => undefined,
    }),
  );
  assert.ok(view.findByText(/S\$5\.50/));
  // react-native-web drops the fontVariant array from the DOM, so the style itself is read.
  const sheet = readFileSync(
    path.join(process.cwd(), "src/app/screens/onboarding/DishPreviewSheet.tsx"),
    "utf8",
  );
  assert.match(sheet, /fontVariant: \["tabular-nums"\]/);
  assert.doesNotMatch(sheet, /variant="price"/);
});

test("F7: the picked tile scales in a check badge and the others do not have one", async () => {
  const foods = TASTE_QUESTION_FOODS.sweet;
  const view = await render(
    createElement(TasteOptionTiles, {
      question: "How sweet?",
      labels: ["Light", "Balanced", "Sweet-forward"],
      foods,
      selectedIndex: 1,
      onSelect: () => undefined,
    }),
  );
  const picked = view.findByTestId("taste-tile-1")!;
  const other = view.findByTestId("taste-tile-0")!;
  assert.equal(picked.getAttribute("aria-checked"), "true");
  assert.equal(other.getAttribute("aria-checked"), "false");
  assert.equal(picked.querySelectorAll('[data-stub="lucide-react-native.Check"]').length, 1);
  assert.equal(other.querySelectorAll('[data-stub="lucide-react-native.Check"]').length, 0);
});

test("F7: the payoff entrance staggers by 40 ms and the tail is capped", () => {
  assert.equal(staggerDelay(0), 0);
  assert.equal(staggerDelay(1), 40);
  assert.equal(staggerDelay(5), 200);
  assert.equal(staggerDelay(20), 240, "no card waits longer than six steps");
});
