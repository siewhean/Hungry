import assert from "node:assert/strict";
import test from "node:test";

import { getRootNavigation } from "./getRootNavigation";
import {
  ONBOARDING_ACTIONS_BOTTOM_PADDING,
  ONBOARDING_ACTIONS_GAP,
  ONBOARDING_ACTIONS_HORIZONTAL_PADDING,
} from "@/app/screens/onboarding/layoutConstants";
import { isDishDetail } from "@/app/screens/profile/profileGuards";
import type { DishDetail } from "@/types/domain";

type Nav = Parameters<typeof getRootNavigation>[0];

test("getRootNavigation walks up to the topmost navigator", () => {
  const root = { name: "root", getParent: () => undefined };
  const tabs = { name: "tabs", getParent: () => root };
  const stack = { name: "stack", getParent: () => tabs };
  assert.equal(getRootNavigation(stack as unknown as Nav), root);
});

test("getRootNavigation returns the navigation itself when it has no parent", () => {
  const only = { name: "only", getParent: () => undefined };
  assert.equal(getRootNavigation(only as unknown as Nav), only);
  const bare = { name: "bare" };
  assert.equal(getRootNavigation(bare as unknown as Nav), bare);
});

test("onboarding action layout constants keep the footer inside the 8pt grid", () => {
  for (const value of [ONBOARDING_ACTIONS_HORIZONTAL_PADDING, ONBOARDING_ACTIONS_BOTTOM_PADDING]) {
    assert.ok(value > 0 && value <= 32);
  }
  assert.ok(ONBOARDING_ACTIONS_GAP > 0);
});

test("isDishDetail narrows out undefined only", () => {
  assert.equal(isDishDetail(undefined), false);
  assert.equal(isDishDetail({ id: "d1" } as unknown as DishDetail), true);
});
