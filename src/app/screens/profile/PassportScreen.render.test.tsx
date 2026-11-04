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

test("tapping a Heritage stamp opens when it was earned and the stalls that count, and closes again", async () => {
  const { useStallInteractionStore } = await import("@/store/useStallInteractionStore");
  const before = useStallInteractionStore.getState().interactions;
  usePassportStore.setState({
    celebratedStampIds: { "cuisine-hawker-1": true },
    stallFacts: {
      "stall-hawker-1": {
        stallId: "stall-hawker-1",
        name: "Ah Seng Hokkien Mee",
        cuisineTags: [],
        buildingType: "hawker_centre",
      },
    },
  });
  useStallInteractionStore.setState({
    interactions: {
      "stall-hawker-1": {
        userId: "user",
        stallId: "stall-hawker-1",
        isSaved: false,
        isTried: true,
        isReviewed: false,
        triedAt: "2026-11-03T04:00:00Z",
      },
    },
  });
  try {
    const view = await renderScreen(PassportScreen as never, { name: "PassportScreen" });
    assert.equal(view.findByTestId("stamp-detail-cuisine-hawker"), null, "closed at first");
    const tile = view.findByLabel(/^Hawker Food Explorer: First stamp/);
    assert.ok(tile, "the hawker stamp is a button");
    await view.press(tile as HTMLElement);
    assert.ok(view.findByTestId("stamp-detail-cuisine-hawker"), "the details open under its row");
    assert.ok(view.text().includes("Earned 3 Nov 2026 at Ah Seng Hokkien Mee"));
    assert.ok(view.findByLabel("Ah Seng Hokkien Mee, visited 3 Nov 2026"), "the stall is listed");
    await view.press(view.findByLabel("Close Hawker Food Explorer") as HTMLElement);
    assert.equal(view.findByTestId("stamp-detail-cuisine-hawker"), null, "closes again");
  } finally {
    useStallInteractionStore.setState({ interactions: before });
    usePassportStore.setState({ stallFacts: {} });
  }
});

test("before any stamp, the first stamp to aim for sits at the top instead of an empty page", async () => {
  usePassportStore.setState({
    progressMap: {
      "cuisine-hawker": {
        categoryId: "cuisine-hawker",
        triedCount: 0,
        nextStampIndex: 0,
        earnedStampThresholds: [],
      },
    },
  });
  const view = await renderScreen(PassportScreen as never, { name: "PassportScreen" });
  assert.ok(view.findByText("Your first stamp"));
  assert.equal(view.findByText("Nothing yet"), null);
  const text = view.text();
  assert.ok(
    text.indexOf("Your first stamp") < text.indexOf("Heritage stamps"),
    "the first stamp comes before the stamp grid",
  );
});
