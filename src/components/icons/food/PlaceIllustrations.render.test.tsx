// The place, stamp, review and privacy illustrations (PlaceIllustrations) mount in light and dark
// appearance, stay hidden from screen readers, and show in the empty states that use them.
// Run with `node scripts/test-render.mjs src/components/icons/food/PlaceIllustrations.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement, type ComponentType } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { FollowedStallsScreen } from "@/app/screens/profile/FollowedStallsScreen";
import { StallSubmissionsScreen } from "@/app/screens/profile/StallSubmissionsScreen";
import {
  CameraPlateIllustration,
  LockHeartIllustration,
  MapPinBowlIllustration,
  PassportStampIllustration,
  ReviewBubblesIllustration,
  StorefrontIllustration,
} from "@/components/icons/food/PlaceIllustrations";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

const ART: [string, ComponentType<{ size?: number; testID?: string }>][] = [
  ["MapPinBowlIllustration", MapPinBowlIllustration],
  ["PassportStampIllustration", PassportStampIllustration],
  ["ReviewBubblesIllustration", ReviewBubblesIllustration],
  ["LockHeartIllustration", LockHeartIllustration],
  ["StorefrontIllustration", StorefrontIllustration],
  ["CameraPlateIllustration", CameraPlateIllustration],
];

beforeEach(async () => {
  await enterScenario("user");
});
afterEach(async () => {
  await cleanup();
  useUIStore.getState().setThemePreference("system");
});

for (const preference of ["light", "dark"] as const) {
  test(`every place illustration mounts in ${preference} appearance, hidden from screen readers`, async () => {
    useUIStore.getState().setThemePreference(preference);
    for (const [name, Art] of ART) {
      const view = await render(createElement(Art, { size: 80, testID: `art-${name}` }));
      const node = view.findByTestId(`art-${name}`);
      assert.ok(node, name);
      assert.equal(node.getAttribute("aria-hidden"), "true", `${name} is decorative`);
      assert.equal(view.text().trim(), "", `${name} draws no words`);
      await view.unmount();
    }
  });
}

test("empty followed stalls and submissions show their illustration", async () => {
  const cases: [ComponentType<never>, string, string, string][] = [
    [
      FollowedStallsScreen as never,
      "FollowedStalls",
      "No followed stalls yet",
      "followed-stalls-empty-art",
    ],
    [
      StallSubmissionsScreen as never,
      "StallSubmissions",
      "No submissions yet",
      "submissions-empty-art",
    ],
  ];
  for (const [Screen, name, emptyTitle, artId] of cases) {
    const view = await renderScreen(Screen, { name });
    await view.settle();
    assert.ok(view.text().includes(emptyTitle), `${name} is empty`);
    assert.ok(view.findByTestId(artId), `${name} shows ${artId}`);
    await view.unmount();
  }
});
