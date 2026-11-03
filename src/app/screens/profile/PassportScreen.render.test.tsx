// The Passport shows a card for a stamp that was just earned, until it is dismissed. Run with
// `node scripts/test-render.mjs src/app/screens/profile/PassportScreen.render.test.tsx`.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { PassportScreen } from "@/app/screens/profile/PassportScreen";
import { usePassportStore } from "@/store/usePassportStore";
import { cleanup, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

const initial = usePassportStore.getState();

beforeEach(async () => {
  await enterScenario("user");
  // Progress is seeded directly; the screen's own recount from tried stalls is switched off.
  usePassportStore.setState({
    computeProgress: () => undefined,
    celebratedStampIds: {},
    progressMap: {
      "cuisine-hawker": {
        categoryId: "cuisine-hawker",
        triedCount: 1,
        nextStampIndex: 1,
        earnedStampThresholds: [1],
      },
    },
  });
});

afterEach(async () => {
  await cleanup();
  usePassportStore.setState({
    computeProgress: initial.computeProgress,
    celebratedStampIds: initial.celebratedStampIds,
    progressMap: initial.progressMap,
  });
});

test("an earned, uncelebrated stamp shows a New stamp card that Got it dismisses", async () => {
  const view = await renderScreen(PassportScreen as never, { name: "PassportScreen" });
  assert.ok(view.findByTestId("passport-unlock-card"), "the unlock card shows");
  assert.ok(view.findByText("New stamp"));
  await view.press(view.findByLabel("Dismiss new stamp") as HTMLElement);
  assert.equal(view.findByTestId("passport-unlock-card"), null, "gone once dismissed");
  assert.equal(
    usePassportStore.getState().celebratedStampIds["cuisine-hawker-1"],
    true,
    "the stamp is marked celebrated so it does not return",
  );
});

test("a stamp already celebrated shows no unlock card", async () => {
  usePassportStore.setState({ celebratedStampIds: { "cuisine-hawker-1": true } });
  const view = await renderScreen(PassportScreen as never, { name: "PassportScreen" });
  assert.equal(view.findByTestId("passport-unlock-card"), null);
});
