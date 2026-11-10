// Pages that used to lead nowhere: mission Start buttons, stamp actions, People suggestions with
// See all, and the profile visibility link on People.
// Run with `node scripts/test-render.mjs src/components/gamification/deadEnds.render.test.tsx`.
import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { FollowersScreen } from "@/app/screens/profile/ProfileConnectionsScreen";
import { MissionCard } from "@/components/gamification/MissionCard";
import { StampDetailPanel } from "@/components/gamification/StampDetailPanel";
import { PeopleSuggestionsSection } from "@/components/social/PeopleSuggestionsSection";
import { ALL_PASSPORT_CATEGORIES, PASSPORT_STAMP_DEFINITIONS } from "@/constants/passportConfig";
import { buildStampHistory } from "@/features/passport/stampHistory";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useSocialStore } from "@/store/useSocialStore";
import { cleanup, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

const restores: (() => void)[] = [];
function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}

beforeEach(async () => {
  await enterScenario("user");
  useSocialStore.setState({ followedUserIds: {}, requestedUserIds: {} });
});
afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()!();
});

const MISSION = {
  id: "m1",
  title: "Write 2 reviews",
  description: "Review two dishes",
  missionType: "write_review",
  requirementCount: 2,
  rewardType: "food_cred",
  rewardValue: 20,
  weekStart: "2026-11-02",
  weekEnd: "2026-11-08",
  isActive: true,
} as never;

test("MissionCard shows Start while unfinished and hides it once complete", async () => {
  let started = 0;
  const start = { label: "Write a review", onPress: () => (started += 1) };
  const view = await render(
    createElement(MissionCard, {
      mission: MISSION,
      progress: { userId: "u", missionId: "m1", currentCount: 1 },
      start,
    }),
  );
  await view.press(view.findByLabel("Write a review for Write 2 reviews"));
  assert.equal(started, 1);
  await view.rerender(
    createElement(MissionCard, {
      mission: MISSION,
      progress: {
        userId: "u",
        missionId: "m1",
        currentCount: 2,
        completedAt: "2026-11-03T00:00:00Z",
      },
      start,
    }),
  );
  assert.equal(view.findByTestId("mission-start-m1"), null);
  assert.equal(view.findByLabel("Write a review for Write 2 reviews"), null);
});

test("an open stamp offers Find more stalls and Add a dish when given", async () => {
  const category = ALL_PASSPORT_CATEGORIES.find((item) => item.id === "hood-chinatown");
  assert.ok(category);
  const history = buildStampHistory({
    category,
    stamps: PASSPORT_STAMP_DEFINITIONS,
    triedStalls: [],
    matches: () => true,
    nameOf: () => undefined,
  });
  const pressed: string[] = [];
  const view = await render(
    createElement(StampDetailPanel, {
      category,
      history,
      onOpenStall: () => undefined,
      onClose: () => undefined,
      onFindMore: () => pressed.push("find"),
      onPostDish: () => pressed.push("post"),
    }),
  );
  await view.press(view.findByLabel(`Find more ${category.name} stalls`));
  await view.press(view.findByText("Add a dish"));
  assert.deepEqual(pressed, ["find", "post"]);

  await view.rerender(
    createElement(StampDetailPanel, {
      category,
      history,
      onOpenStall: () => undefined,
      onClose: () => undefined,
    }),
  );
  assert.equal(view.findByTestId("stamp-detail-actions"), null);
});

test("People suggestions show at most `max` rows and See all when there are more", async () => {
  stub(getHungryService().social, "listPeopleSuggestions", async () =>
    ["a", "b", "c", "d"].map((id) => ({
      userId: `s-${id}`,
      displayName: `Person ${id}`,
      mutualCount: 0,
      recentActivity: 1,
      reason: "active" as const,
    })),
  );
  let seeAll = 0;
  const view = await render(
    createElement(PeopleSuggestionsSection, {
      title: "People you may know",
      max: 3,
      onOpen: () => undefined,
      onSeeAll: () => (seeAll += 1),
    }),
  );
  await view.settle();
  assert.ok(view.findByTestId("people-suggestion-s-c"));
  assert.equal(view.findByTestId("people-suggestion-s-d"), null);
  await view.press(view.findByLabel("See all People you may know"));
  assert.equal(seeAll, 1);
});

test("your People screen links to who can see your profile", async () => {
  stub(getHungryService().social, "listFollowers", async () => []);
  const view = await renderScreen(FollowersScreen as never, { name: "Followers" });
  await view.press(view.findByTestId("people-visibility-link"));
  assert.ok(
    view.navigation.calls.some((call) => call.method === "navigate" && call.args[0] === "Settings"),
  );
});
