// The Food Portfolio, Leaderboard and People illustrations (SocialIllustrations) mount in light
// and dark appearance, stay hidden from screen readers, and show in the empty states that use
// them. Run with `node scripts/test-render.mjs src/components/icons/food/SocialIllustrations.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement, type ComponentType } from "react";
import test, { afterEach } from "node:test";

import {
  EmptyBoardIllustration,
  FeedEmptyIllustration,
  FirstPostIllustration,
  FollowersEmptyIllustration,
  FollowingEmptyIllustration,
  PeopleFoundIllustration,
  PodiumIllustration,
  PortfolioEmptyIllustration,
} from "@/components/icons/food/SocialIllustrations";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render } from "@/test/render";

const ART: [string, ComponentType<{ size?: number; testID?: string }>][] = [
  ["PodiumIllustration", PodiumIllustration],
  ["EmptyBoardIllustration", EmptyBoardIllustration],
  ["PortfolioEmptyIllustration", PortfolioEmptyIllustration],
  ["FollowersEmptyIllustration", FollowersEmptyIllustration],
  ["FollowingEmptyIllustration", FollowingEmptyIllustration],
  ["FeedEmptyIllustration", FeedEmptyIllustration],
  ["FirstPostIllustration", FirstPostIllustration],
  ["PeopleFoundIllustration", PeopleFoundIllustration],
];

afterEach(async () => {
  await cleanup();
  useUIStore.getState().setThemePreference("system");
});

for (const preference of ["light", "dark"] as const) {
  test(`every illustration mounts in ${preference} appearance, hidden from screen readers`, async () => {
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
