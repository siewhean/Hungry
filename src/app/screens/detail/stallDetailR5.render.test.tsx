// Round-five stall page fixes (R5-STALL-*). Run with `npm run test:render`.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { StallDetailScreen } from "@/app/screens/detail/StallDetailScreen";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { cleanup, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import { readRepoFile } from "@/test/sourceContracts";

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
});

const openStall = (venueId = STALL) =>
  renderScreen(StallDetailScreen as never, { name: "StallDetail", params: { venueId } });

test("R5-STALL-7: the Call chip reads the phone as +65 9123 4567", async () => {
  const discovery = getHungryService().discovery;
  const original = discovery.getPublicMerchantProfile.bind(discovery);
  override(discovery, "getPublicMerchantProfile", async (venueId: string) => {
    const profile = await original(venueId);
    return { ...(profile ?? { venueId, socialLinks: [] }), contactPhone: "+6591234567" } as never;
  });
  const view = await openStall();
  await view.settle();
  assert.ok(view.findByLabel("Call Tian Tian Chicken Rice on +65 9123 4567"), "formatted number");
  // The number is not repeated as text in a Contact details card (the mock also has an email).
  assert.doesNotMatch(view.text(), /\+65 ?9123|\+6591234567/);
});

test("R5-STALL-11: the menu count only shows when the list is filtered or cut off", async () => {
  const view = await openStall();
  await view.settle();
  assert.ok(view.findByText("Menu"));
  assert.doesNotMatch(view.text(), /Showing \d+ of \d+/, "everything is shown: no count");
});

test("R5-STALL-1: the page's only filled button is the bar's Write a review (source contract)", () => {
  const help = readRepoFile("src/components/stall/StallHelpFillCard.tsx");
  for (const button of help.match(/<Button[\s\S]*?\/>/g) ?? []) {
    assert.match(button, /variant="secondary"/, "every button in the help card is secondary");
  }
  const stall = readRepoFile("src/app/screens/detail/StallDetailScreen.tsx");
  assert.doesNotMatch(
    stall,
    /ctaLabel=\{promotion\.targetDishId/,
    "a promotion is a tappable card",
  );
  assert.match(stall, /Own this stall\? Claim it/, "claiming is a quiet text row");
  assert.doesNotMatch(stall, /label=\{[\s\S]{0,200}Claim this stall/, "not a Button");
});

test("R5-STALL-5: with no photo the page has no hero band, only a gap under Back and Share (source contract)", () => {
  const stall = readRepoFile("src/app/screens/detail/StallDetailScreen.tsx");
  assert.match(stall, /const heroHeight = hasHero \? Math\.min\(screenWidth \* 0\.75, 420\) : 0/);
  assert.match(stall, /\{hasHero \? \(\s*<DetailHeroFade/);
});

test("R5-STALL-4: the page's scroll is a UI-thread handler; no JS scroll listener or state", () => {
  const stall = readRepoFile("src/app/screens/detail/StallDetailScreen.tsx");
  assert.match(stall, /useAnimatedScrollHandler\(/);
  assert.match(stall, /onScroll=\{onScroll\}/);
  assert.doesNotMatch(stall, /Animated\.event|new Animated\.Value|addListener/);
  const dish = readRepoFile("src/app/screens/detail/DishDetailScreenV2.tsx");
  assert.match(dish, /useAnimatedScrollHandler\(/);
  assert.doesNotMatch(dish, /Animated\.event|new Animated\.Value/);
});
