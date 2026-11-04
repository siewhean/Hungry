// Home's meal-picks card: the push is offered after a first save or tried, and the phone is asked
// only when the diner taps Turn on. Run with `npm run test:render`.
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { createElement } from "react";

import { MealPicksCard } from "@/components/home/MealPicksCard";
import { useHomeNudgeStore } from "@/store/useHomeNudgeStore";
import { useOnboardingAnswersStore } from "@/store/useOnboardingAnswersStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

function setSaved(count: number) {
  const profile = useProfileStore.getState().profile;
  useProfileStore.setState({
    profile: {
      ...profile,
      favouriteDishIds: Array.from({ length: count }, (_, index) => `dish-${index}`),
      reviewedDishIds: [],
    },
  });
}

beforeEach(() => {
  useSessionStore.setState({ isAuthenticated: true });
  useHomeNudgeStore.setState({ mealPicksSnoozedAt: null });
  useOnboardingAnswersStore.setState({ mealTimes: { lunch: "12:00" } });
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test("after a first save it offers the picks and asks the phone on Turn on", async () => {
  setSaved(1);
  const asked: boolean[] = [];
  const view = await render(
    createElement(MealPicksCard, {
      horizontalPadding: 0,
      isNative: true,
      getPermission: async () => "undetermined" as const,
      register: async ({ askPermission }) => {
        asked.push(askPermission);
        return false;
      },
    }),
  );
  await settle();
  assert.match(view.text(), /Three picks before you eat\?/);
  assert.match(view.text(), /11:15 am, before your lunch/);
  await view.press(view.findByText("Turn on"));
  await settle();
  assert.deepEqual(asked, [true]);
  assert.doesNotMatch(view.text(), /Three picks before you eat\?/);
});

test("with nothing saved or tried yet, or after Not now, it stays away", async () => {
  setSaved(0);
  const empty = await render(
    createElement(MealPicksCard, {
      horizontalPadding: 0,
      isNative: true,
      getPermission: async () => "undetermined" as const,
    }),
  );
  await settle();
  assert.doesNotMatch(empty.text(), /Three picks/);
  cleanup();

  setSaved(2);
  const view = await render(
    createElement(MealPicksCard, {
      horizontalPadding: 0,
      isNative: true,
      getPermission: async () => "undetermined" as const,
    }),
  );
  await settle();
  await view.press(view.findByText("Not now"));
  await settle();
  assert.doesNotMatch(view.text(), /Three picks/);
  assert.notEqual(useHomeNudgeStore.getState().mealPicksSnoozedAt, null);
});
