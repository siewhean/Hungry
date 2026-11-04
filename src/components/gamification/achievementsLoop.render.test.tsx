// The achievements loop: the progress ring, the Home next-stamp card, the stamp moment and the
// host that shows it right after the action. Run with
// `node scripts/test-render.mjs src/components/gamification/achievementsLoop.render.test.tsx`.

import assert from "node:assert/strict";
import { act, createElement } from "react";
import { User } from "lucide-react-native";
import test, { afterEach, beforeEach } from "node:test";

import { AchievementBadgeArt, medalMetal } from "@/components/gamification/AchievementBadgeArt";
import { AchievementDetailPanel } from "@/components/gamification/AchievementDetailPanel";
import { AchievementsSection } from "@/components/gamification/AchievementsSection";
import { NextStampCard } from "@/components/gamification/NextStampCard";
import { PassportStampArt, STAMP_LOOKS } from "@/components/gamification/PassportStampArt";
import { PassportStampBadge } from "@/components/gamification/PassportStampBadge";
import {
  MEDAL_LAND_MS,
  STAMP_IMPACT_MS,
  StampMoment,
  momentWordsDelay,
} from "@/components/gamification/StampMoment";
import { StampDetailPanel } from "@/components/gamification/StampDetailPanel";
import { computeAchievements } from "@/features/achievements/achievements";
import { buildStampHistory } from "@/features/passport/stampHistory";
import {
  MOMENT_DELAY_MS,
  MOMENT_SETTLE_MS,
  StampMomentHost,
} from "@/components/gamification/StampMomentHost";
import { AppBottomTabItem } from "@/components/ui/AppBottomTabItem";
import { InfoPopup } from "@/components/ui/InfoPopup";
import { ProgressRing } from "@/components/ui/ProgressRing";
import {
  ALL_PASSPORT_CATEGORIES,
  PASSPORT_STAMP_DEFINITIONS,
  computePassportProgress,
} from "@/constants/passportConfig";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { clearExperimentOverrides, setExperimentOverride } from "@/lib/experiments/experiments";
import { useMomentStore } from "@/store/useMomentStore";
import { usePassportStore } from "@/store/usePassportStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { cleanup, render } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { StallInteraction, UserPassportProgress } from "@/types/domain";

const initialPassport = usePassportStore.getState();

function progressWith(counts: Record<string, number>) {
  const map: Record<string, UserPassportProgress> = {};
  for (const category of ALL_PASSPORT_CATEGORIES) {
    map[category.id] = computePassportProgress(category, counts[category.id] ?? 0);
  }
  return map;
}

function tried(stallId: string): StallInteraction {
  return {
    userId: "u",
    stallId,
    isSaved: false,
    isTried: true,
    isReviewed: false,
    triedAt: "2026-11-03T04:00:00.000Z",
  };
}

async function wait(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

beforeEach(async () => {
  await enterScenario("user");
  clearTrackedAnalyticsEvents();
  useMomentStore.getState()._reset();
  useStallInteractionStore.setState({ interactions: {}, isLoaded: true });
});

afterEach(async () => {
  await cleanup();
  clearExperimentOverrides();
  usePassportStore.setState({
    computeProgress: initialPassport.computeProgress,
    celebratedStampIds: {},
    progressMap: {},
    isComputed: false,
  });
  useStallInteractionStore.setState({ interactions: {}, isLoaded: false });
});

test("the ring reports its fill to screen readers and clamps out-of-range values", async () => {
  const view = await render(createElement(ProgressRing, { fraction: 0.4, size: 48 }));
  const bar = view.container.querySelector('[role="progressbar"]');
  assert.equal(bar?.getAttribute("aria-valuenow"), "40");
  await view.rerender(createElement(ProgressRing, { fraction: 7, size: 48 }));
  assert.equal(
    view.container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow"),
    "100",
  );
  await view.rerender(createElement(ProgressRing, { fraction: Number.NaN, size: 48 }));
  assert.equal(
    view.container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow"),
    "0",
  );
});

test("a decorative ring is not a progress bar", async () => {
  const view = await render(
    createElement(ProgressRing, { fraction: 0.5, size: 32, decorative: true }),
  );
  assert.equal(view.container.querySelector('[role="progressbar"]'), null);
});

test("the Home card names the nearest stamp, opens the Passport and logs the view and tap", async () => {
  usePassportStore.setState({
    isComputed: true,
    progressMap: progressWith({ "cuisine-malay": 2 }),
  });
  let opened = 0;
  const view = await render(createElement(NextStampCard, { onOpenPassport: () => (opened += 1) }));
  assert.ok(view.findByText("1 more stall to your next stamp"));
  assert.ok(view.findByText(/Malay Food Explorer, 2 of 3 tried/));
  await view.press(view.findByTestId("next-stamp-card"));
  assert.equal(opened, 1);
  const names = getTrackedAnalyticsEvents().map((event) => event.event);
  assert.ok(names.includes("next_stamp_card_viewed"));
  assert.ok(names.includes("next_stamp_card_tapped"));
});

test("the Home card is hidden until progress is counted", async () => {
  usePassportStore.setState({ isComputed: false, progressMap: {} });
  const view = await render(createElement(NextStampCard, { onOpenPassport: () => undefined }));
  assert.equal(view.findByTestId("next-stamp-card"), null);

  await act(async () => {
    usePassportStore.setState({
      isComputed: true,
      progressMap: progressWith({ "cuisine-malay": 2 }),
    });
  });
  assert.ok(view.findByTestId("next-stamp-card"));
});

test("the kill switch hides the Home card", async () => {
  setExperimentOverride("achievements_loop_v1", "control");
  usePassportStore.setState({
    isComputed: true,
    progressMap: progressWith({ "cuisine-malay": 2 }),
  });
  const view = await render(createElement(NextStampCard, { onOpenPassport: () => undefined }));
  assert.equal(view.findByTestId("next-stamp-card"), null);
});

test("a stamp moment shows the new stamp and both buttons work", async () => {
  const stamp = PASSPORT_STAMP_DEFINITIONS.find((item) => item.id === "cuisine-malay-3");
  const category = ALL_PASSPORT_CATEGORIES.find((item) => item.id === "cuisine-malay");
  assert.ok(stamp && category);
  const calls: string[] = [];
  const view = await render(
    createElement(StampMoment, {
      content: { kind: "stamp", stamp, category, triedCount: 3 },
      reduceMotion: false,
      onOpenPassport: () => calls.push("open"),
      onDismiss: () => calls.push("dismiss"),
    }),
  );
  assert.ok(view.findByText("New stamp"));
  assert.ok(view.findByText("Malay Food Explorer"));
  assert.ok(view.text().includes("3 stalls tried"));
  assert.ok(
    view.findByLabel("Level 2 of 4"),
    "the second stamp of a trail shows two of four stars",
  );
  await view.press(view.findByText("See my Passport"));
  await view.press(view.findByText("Keep exploring"));
  assert.deepEqual(calls, ["open", "dismiss"]);
});

test("an achievement moment names the tier and what was done", async () => {
  const view = await render(
    createElement(StampMoment, {
      content: {
        kind: "achievement",
        unlock: {
          achievementId: "critic",
          title: "Critic",
          icon: "pen",
          level: 2,
          totalLevels: 4,
          reached: "Write 5 reviews",
        },
      },
      reduceMotion: true,
      onOpenPassport: () => undefined,
      onDismiss: () => undefined,
    }),
  );
  assert.ok(view.findByText("Achievement unlocked"));
  assert.ok(view.findByText("Critic"));
  assert.ok(view.text().includes("Level 2 of 4. Write 5 reviews."));
});

test("an achievement moment tosses its medal and lights a pip for each level", async () => {
  const unlock = {
    achievementId: "critic" as const,
    title: "Critic",
    icon: "pen" as const,
    level: 2,
    totalLevels: 4,
    reached: "Write 5 reviews",
  };
  const view = await render(
    createElement(StampMoment, {
      content: { kind: "achievement", unlock },
      reduceMotion: false,
      onOpenPassport: () => undefined,
      onDismiss: () => undefined,
    }),
  );
  assert.ok(view.findByTestId("medal-reveal"), "achievements get the medal toss, not the stamp");
  assert.equal(view.findByTestId("stamp-landing"), null);
  assert.ok(view.findByLabel("Level 2 of 4"));
  // The words wait for the medal to land and its pips to light.
  const wordsAt = momentWordsDelay({ kind: "achievement", unlock });
  assert.ok(wordsAt > MEDAL_LAND_MS + 4 * 100);
});

test("a stamp moment lands the stamp, and its words wait for the stars", () => {
  const stamp = PASSPORT_STAMP_DEFINITIONS.find((item) => item.id === "cuisine-malay-3");
  const category = ALL_PASSPORT_CATEGORIES.find((item) => item.id === "cuisine-malay");
  assert.ok(stamp && category);
  const wordsAt = momentWordsDelay({ kind: "stamp", stamp, category, triedCount: 3 });
  assert.ok(wordsAt > STAMP_IMPACT_MS, "words come after the stamp hits the page");
  const first = PASSPORT_STAMP_DEFINITIONS.find(
    (item) => item.categoryId === "cuisine-malay" && item.index === 0,
  );
  assert.ok(first);
  assert.ok(
    wordsAt > momentWordsDelay({ kind: "stamp", stamp: first, category, triedCount: 1 }),
    "more stars to pop means a later reveal",
  );
});

test("an open stamp lists each level earned with its stall, and opens a stall when tapped", async () => {
  const category = ALL_PASSPORT_CATEGORIES.find((item) => item.id === "hood-chinatown");
  assert.ok(category);
  const history = buildStampHistory({
    category,
    stamps: PASSPORT_STAMP_DEFINITIONS,
    triedStalls: [
      { stallId: "s1", triedAt: "2026-10-30T04:00:00Z" },
      { stallId: "s2", triedAt: "2026-11-01T04:00:00Z" },
      { stallId: "s3" },
    ],
    matches: () => true,
    nameOf: (id) => ({ s1: "Chinatown Complex Laksa", s2: "Smith Street Satay" })[id],
  });
  const opened: string[] = [];
  const view = await render(
    createElement(StampDetailPanel, {
      category,
      history,
      onOpenStall: (id) => opened.push(id),
      onClose: () => opened.push("close"),
    }),
  );
  assert.ok(view.text().includes("Level 2 of 4"));
  assert.ok(view.text().includes("Earned 30 Oct 2026 at Chinatown Complex Laksa"));
  assert.ok(view.text().includes("Next: Trail regular. Visit 2 more stalls that count."));
  assert.ok(view.findByText("A stall you visited"), "a stall without a name still shows");
  await view.press(view.findByLabel("Smith Street Satay, visited 1 Nov 2026"));
  await view.press(view.findByLabel(`Close ${category.name}`));
  assert.deepEqual(opened, ["s2", "close"]);
});

test("a stamp not started yet says what earns it", async () => {
  const category = ALL_PASSPORT_CATEGORIES.find((item) => item.id === "cuisine-indian");
  assert.ok(category);
  const history = buildStampHistory({
    category,
    stamps: PASSPORT_STAMP_DEFINITIONS,
    triedStalls: [],
    matches: () => false,
    nameOf: () => undefined,
  });
  const view = await render(
    createElement(StampDetailPanel, {
      category,
      history,
      onOpenStall: () => undefined,
      onClose: () => undefined,
    }),
  );
  assert.ok(view.findByText("Not stamped yet"));
  assert.ok(view.text().includes(category.description));
  assert.ok(view.text().includes("Visit 1 more stall that counts."));
});

function seedPassport(counts: () => Record<string, number>) {
  // Progress follows the counts the test sets; the real recount from tried stalls is replaced.
  usePassportStore.setState({
    celebratedStampIds: {},
    computeProgress: () =>
      usePassportStore.setState({ progressMap: progressWith(counts()), isComputed: true }),
  });
}

test("the host stays quiet for stamps already earned when the data settles", async () => {
  seedPassport(() => ({ "cuisine-hawker": 1 }));
  useStallInteractionStore.setState({ interactions: { s1: tried("s1") } });
  const view = await render(createElement(StampMomentHost, { onOpenPassport: () => undefined }));
  await wait(MOMENT_DELAY_MS + 200);
  assert.equal(view.findByTestId("stamp-moment"), null);
  assert.equal(useMomentStore.getState().queue.length, 0);
});

test("a stamp earned after that shows a moment once, marks it celebrated and opens the Passport", async () => {
  let counts: Record<string, number> = { "cuisine-hawker": 0 };
  seedPassport(() => counts);
  useStallInteractionStore.setState({ interactions: {} });
  let opened = 0;
  const view = await render(
    createElement(StampMomentHost, { onOpenPassport: () => (opened += 1) }),
  );
  assert.equal(view.findByTestId("stamp-moment"), null);

  counts = { "cuisine-hawker": 1 };
  await act(async () => {
    useStallInteractionStore.setState({ interactions: { s1: tried("s1") } });
  });
  assert.equal(view.findByTestId("stamp-moment"), null, "waits a moment before the celebration");
  assert.equal(usePassportStore.getState().celebratedStampIds["cuisine-hawker-1"], true);

  await wait(MOMENT_DELAY_MS + 300);
  assert.ok(view.findByTestId("stamp-moment"));
  assert.ok(view.findByText("Hawker Food Explorer"));
  assert.ok(getTrackedAnalyticsEvents().some((event) => event.event === "stamp_moment_shown"));

  await view.press(view.findByText("See my Passport"));
  assert.equal(opened, 1);
  assert.equal(view.findByTestId("stamp-moment"), null);
  assert.ok(getTrackedAnalyticsEvents().some((event) => event.event === "stamp_moment_opened"));

  // The same stamp does not come back when the diner marks another stall.
  await act(async () => {
    useStallInteractionStore.setState({ interactions: { s1: tried("s1"), s2: tried("s2") } });
  });
  await wait(MOMENT_DELAY_MS + 200);
  assert.equal(view.findByTestId("stamp-moment"), null);
});

test("a moment waits while a sheet or modal is open, then shows once it is gone", async () => {
  let counts: Record<string, number> = { "cuisine-hawker": 0 };
  seedPassport(() => counts);
  useStallInteractionStore.setState({ interactions: {} });
  const host = (blocked: boolean) =>
    createElement(StampMomentHost, { blocked, onOpenPassport: () => undefined });
  const view = await render(host(true));

  counts = { "cuisine-hawker": 1 };
  await act(async () => {
    useStallInteractionStore.setState({ interactions: { s1: tried("s1") } });
  });
  // Longer than the delay and the auto-dismiss: a hidden moment must not time out unseen.
  await wait(MOMENT_DELAY_MS + 300);
  assert.equal(view.findByTestId("stamp-moment"), null);
  assert.equal(useMomentStore.getState().queue.length, 1, "still waiting in the queue");

  await view.rerender(host(false));
  assert.equal(view.findByTestId("stamp-moment"), null, "waits a moment after the modal closes");
  await wait(MOMENT_DELAY_MS + 300);
  assert.ok(view.findByTestId("stamp-moment"));
});

test("meeting the weekly goal shows a moment on any screen, once", async () => {
  seedPassport(() => ({}));
  useStallInteractionStore.setState({ interactions: {} });
  const view = await render(createElement(StampMomentHost, { onOpenPassport: () => undefined }));
  const now = new Date().toISOString();
  await act(async () => {
    useStallInteractionStore.setState({
      interactions: {
        s1: { ...tried("s1"), triedAt: now },
        s2: { ...tried("s2"), triedAt: now },
        s3: { ...tried("s3"), triedAt: now },
      },
    });
  });
  await wait(MOMENT_DELAY_MS + 300);
  assert.ok(view.findByTestId("stamp-moment"));
  assert.ok(view.findByText("Weekly goal complete"));
  assert.ok(getTrackedAnalyticsEvents().some((event) => event.event === "weekly_goal_completed"));
  await view.press(view.findByText("Keep exploring"));

  await act(async () => {
    useStallInteractionStore.setState({
      interactions: {
        s1: { ...tried("s1"), triedAt: now },
        s2: { ...tried("s2"), triedAt: now },
        s3: { ...tried("s3"), triedAt: now },
        s4: { ...tried("s4"), triedAt: now },
      },
    });
  });
  await wait(MOMENT_DELAY_MS + 200);
  assert.equal(view.findByText("Weekly goal complete"), null, "not again the same week");
});

test("every Passport category has its own stamp design, with a distinct emblem and label", () => {
  const looks = ALL_PASSPORT_CATEGORIES.map((category) => STAMP_LOOKS[category.id]);
  assert.ok(looks.every(Boolean), "no category falls back to another's stamp");
  assert.equal(new Set(looks.map((look) => look!.emblem)).size, ALL_PASSPORT_CATEGORIES.length);
  assert.equal(new Set(looks.map((look) => look!.label)).size, ALL_PASSPORT_CATEGORIES.length);
});

test("a stamp badge names the stamp for screen readers and says when it is locked", async () => {
  const stamp = PASSPORT_STAMP_DEFINITIONS.find((item) => item.id === "hood-bugis-3")!;
  const earned = await render(createElement(PassportStampBadge, { stamp, earned: true }));
  assert.ok(earned.findByLabel("Bugis Food Trail: Return visit passport stamp"));
  await earned.unmount();
  const locked = await render(
    createElement(PassportStampBadge, { stamp, earned: false, size: "sm" }),
  );
  assert.ok(locked.findByLabel("Bugis Food Trail: Return visit passport stamp, locked"));
  await locked.unmount();
  // The art alone is hidden from screen readers: the badge or tile around it does the talking.
  const art = await render(
    createElement(PassportStampArt, {
      categoryId: "cuisine-malay",
      level: 3,
      earned: true,
      size: 80,
    }),
  );
  assert.equal(art.findByLabel("Bugis Food Trail: Return visit passport stamp"), null);
  await art.unmount();
});

test("achievement medals go bronze, silver, gold, and the last level is always gold", () => {
  assert.equal(medalMetal(0, 4), "none");
  assert.equal(medalMetal(1, 4), "bronze");
  assert.equal(medalMetal(2, 4), "silver");
  assert.equal(medalMetal(3, 4), "gold");
  assert.equal(medalMetal(4, 4), "gold");
  assert.equal(medalMetal(3, 3), "gold", "a three-level achievement ends on gold too");
});

test("every achievement icon draws a medal at every level", async () => {
  const icons = [
    "utensils",
    "map-pin",
    "store",
    "flame",
    "candy",
    "coins",
    "pen",
    "bookmark",
  ] as const;
  for (const icon of icons) {
    for (const level of [0, 1, 4]) {
      const view = await render(
        createElement(AchievementBadgeArt, { icon, level, totalLevels: 4, size: 60 }),
      );
      assert.ok(view.container.innerHTML.length > 0, `${icon} level ${level} renders`);
      await view.unmount();
    }
  }
});

test("the host renders nothing and counts nothing under the kill switch", async () => {
  let recounts = 0;
  usePassportStore.setState({ computeProgress: () => void (recounts += 1) });
  setExperimentOverride("achievements_loop_v1", "control");
  const view = await render(createElement(StampMomentHost, { onOpenPassport: () => undefined }));
  await wait(100);
  assert.equal(recounts, 0);
  assert.equal(view.findByTestId("stamp-moment"), null);
});

test("once the data has settled the host reports the diner's achievements", async () => {
  seedPassport(() => ({}));
  const reported: string[] = [];
  const original = useMomentStore.getState().reportAchievements;
  useMomentStore.setState({
    reportAchievements: (userId, rows) => {
      reported.push(`${userId}:${rows.length}`);
      return [];
    },
  });
  try {
    await render(createElement(StampMomentHost, { onOpenPassport: () => undefined }));
    assert.equal(reported.length, 0, "nothing is reported while data may still be arriving");
    await wait(MOMENT_SETTLE_MS + 200);
    assert.ok(reported.length >= 1);
    assert.match(reported[0], /:8$/, "all eight achievements are checked");
  } finally {
    useMomentStore.setState({ reportAchievements: original });
  }
});

test("the Profile tab draws a ring only when there is progress to show", async () => {
  const props = { icon: User, label: "Profile", onPress: () => undefined };
  const html = async (extra: Record<string, unknown>) => {
    const view = await render(createElement(AppBottomTabItem, { ...props, ...extra }));
    const out = view.html();
    await view.unmount();
    return out;
  };
  const plain = await html({});
  assert.equal(await html({ ringFraction: 0 }), plain, "an empty ring is not drawn");
  assert.notEqual(await html({ ringFraction: 0.5 }), plain, "progress draws the ring");
});

test("an achievement card opens a pop-up with every level and what earns it, and it closes again", async () => {
  const rows = computeAchievements({
    triedDishes: 12,
    distinctCentres: 1,
    stallsVisited: 2,
    spicyDishes: 0,
    sweetDishes: 0,
    budgetDishes: 0,
    reviewsWritten: 1,
    dishesSaved: 0,
  });
  const view = await render(createElement(AchievementsSection, { rows }));
  assert.equal(view.findByTestId("achievement-detail-dish-collector"), null, "closed at first");

  await view.press(view.findByLabel(/^Dish collector, level 1 of 4/));
  assert.ok(view.findByTestId("achievement-detail-dish-collector"), "the details pop up");
  assert.ok(view.text().includes("Try 10 different dishes"));
  assert.ok(view.text().includes("Try 100 different dishes"));
  assert.ok(view.findByLabel("Level 1, Try 10 different dishes, reached"));
  assert.ok(view.findByLabel("Level 2, Try 25 different dishes, not yet"));
  assert.ok(view.text().includes("13 more dishes to reach level 2."));

  await view.press(view.findByLabel("Close Dish collector"));
  assert.equal(view.findByTestId("achievement-detail-dish-collector"), null, "closes again");
});

test("tapping outside the pop-up closes it", async () => {
  const rows = computeAchievements({
    triedDishes: 0,
    distinctCentres: 0,
    stallsVisited: 0,
    spicyDishes: 0,
    sweetDishes: 0,
    budgetDishes: 0,
    reviewsWritten: 0,
    dishesSaved: 0,
  });
  const view = await render(createElement(AchievementsSection, { rows }));
  await view.press(view.findByLabel(/^Critic, level 0 of 4/));
  assert.ok(view.text().includes("Not started"));
  await view.press(view.findByLabel("Dismiss pop-up"));
  assert.equal(view.findByTestId("achievement-detail-critic"), null);
});

test("the detail panel names a finished achievement and has no next step", async () => {
  const [row] = computeAchievements({
    triedDishes: 100,
    distinctCentres: 0,
    stallsVisited: 0,
    spicyDishes: 0,
    sweetDishes: 0,
    budgetDishes: 0,
    reviewsWritten: 0,
    dishesSaved: 0,
  });
  assert.ok(row);
  let closed = 0;
  const view = await render(
    createElement(AchievementDetailPanel, { row, onClose: () => (closed += 1) }),
  );
  assert.ok(view.text().includes("Every level done"));
  assert.ok(!view.text().includes("more dishes to reach"));
  await view.press(view.findByLabel("Close Dish collector"));
  assert.equal(closed, 1);
});

test("InfoPopup draws nothing while closed and shows its card when open", async () => {
  const closed = await render(
    createElement(InfoPopup, {
      visible: false,
      onClose: () => undefined,
      label: "Details",
      children: "Hello",
    }),
  );
  assert.ok(!closed.text().includes("Hello"));
  await closed.unmount();
  const open = await render(
    createElement(InfoPopup, {
      visible: true,
      onClose: () => undefined,
      label: "Details",
      children: "Hello",
    }),
  );
  assert.ok(open.text().includes("Hello"));
});
