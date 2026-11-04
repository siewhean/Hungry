// The hooks behind the Home next-stamp card and the Profile tab ring. Run with
// `node scripts/test-render.mjs src/features/passport/useNextStamp.render.test.tsx`.

import assert from "node:assert/strict";
import { act, createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { ALL_PASSPORT_CATEGORIES, computePassportProgress } from "@/constants/passportConfig";
import { useNextStamp, useAchievementsLoopEnabled } from "@/features/passport/useNextStamp";
import { useWeeklyGoal } from "@/features/passport/useWeeklyGoal";
import { clearExperimentOverrides, setExperimentOverride } from "@/lib/experiments/experiments";
import { useChecklistStore } from "@/store/useChecklistStore";
import { usePassportStore } from "@/store/usePassportStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { cleanup, render } from "@/test/render";
import type { StallInteraction, UserPassportProgress } from "@/types/domain";

function Probe() {
  const goal = useWeeklyGoal();
  const next = useNextStamp();
  const loop = useAchievementsLoopEnabled();
  return createElement(
    "pre",
    { "data-testid": "probe" },
    JSON.stringify({ count: goal.count, next: next?.headline ?? null, kind: next?.kind, loop }),
  );
}

async function probe() {
  const view = await render(createElement(Probe));
  return () => JSON.parse(view.findByTestId("probe")?.textContent ?? "{}");
}

function progress(counts: Record<string, number>) {
  const map: Record<string, UserPassportProgress> = {};
  for (const category of ALL_PASSPORT_CATEGORIES) {
    map[category.id] = computePassportProgress(category, counts[category.id] ?? 0);
  }
  return map;
}

const justNow = () => new Date().toISOString();

function tried(stallId: string): StallInteraction {
  return {
    userId: "u",
    stallId,
    isSaved: false,
    isTried: true,
    isReviewed: false,
    triedAt: justNow(),
  };
}

beforeEach(() => {
  useStallInteractionStore.setState({ interactions: {} });
  useChecklistStore.setState({ items: {} });
  usePassportStore.setState({ isComputed: false, progressMap: {} });
});

afterEach(async () => {
  await cleanup();
  clearExperimentOverrides();
  usePassportStore.setState({ isComputed: false, progressMap: {} });
  useStallInteractionStore.setState({ interactions: {} });
  useChecklistStore.setState({ items: {} });
});

test("the weekly goal counts a tried stall and its checklist entry once", async () => {
  useStallInteractionStore.setState({ interactions: { s1: tried("s1") } });
  useChecklistStore.setState({
    items: {
      list: [
        { id: "i1", stallId: "s1", triedAt: justNow() },
        { id: "i2", dishId: "d1", triedAt: justNow() },
        { id: "i3", stallId: "s9" },
      ],
    } as never,
  });
  const read = await probe();
  assert.equal(read().count, 2, "s1 once, the dish once, the untried item not at all");
});

test("the next stamp waits for the Passport to be counted, then follows its progress", async () => {
  const read = await probe();
  assert.equal(read().next, null);

  await act(async () => {
    usePassportStore.setState({ isComputed: true, progressMap: progress({ "cuisine-malay": 2 }) });
  });
  assert.equal(read().next, "1 more stall to your next stamp");
  assert.equal(read().kind, "stamp");
});

test("the loop is on by default and the PostHog kill switch turns it off", async () => {
  assert.equal((await probe())().loop, true);
  await cleanup();
  setExperimentOverride("achievements_loop_v1", "control");
  assert.equal((await probe())().loop, false);
});
