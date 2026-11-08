import assert from "node:assert/strict";
import test from "node:test";

import { missionStart } from "@/features/profile/missionStart";
import type { MissionType } from "@/types/domain";

const TYPES: MissionType[] = [
  "save_stalls",
  "add_stall",
  "create_post",
  "write_review",
  "mark_tried",
  "add_to_collection",
  "helpful_vote",
];

test("every mission type has a Start button that goes somewhere it can be done", () => {
  const seen: unknown[][] = [];
  const nav = { navigate: (...args: unknown[]) => seen.push(args) };
  for (const type of TYPES) {
    const start = missionStart(type);
    assert.ok(start.label.length > 0, type);
    start.open(nav as never);
  }
  assert.deepEqual(seen, [
    ["BrowseStalls"],
    ["MainTabs", { screen: "Profile", params: { screen: "AddStall" } }],
    ["Post"],
    ["ReviewStack", { screen: "ReviewMain" }],
    ["SearchHome"],
    ["Favourites"],
    ["MainTabs", { screen: "Review" }],
  ]);
});
