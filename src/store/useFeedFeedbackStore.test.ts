import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { MUTE_FOOD_TYPE_MS, SESSION_ACTION_LIMIT } from "@/features/discover/personalFeedback";
import { useFeedFeedbackStore } from "./useFeedFeedbackStore";

beforeEach(() => useFeedFeedbackStore.getState()._reset());

test("session actions keep only the latest ones", () => {
  const { recordSessionAction } = useFeedFeedbackStore.getState();
  for (let index = 0; index < SESSION_ACTION_LIMIT + 4; index += 1) {
    recordSessionAction(`dish-${index}`, "open", 1_000 + index);
  }
  const actions = useFeedFeedbackStore.getState().sessionActions;
  assert.equal(actions.length, SESSION_ACTION_LIMIT);
  assert.equal(actions[0]?.dishId, "dish-4");
  assert.equal(actions.at(-1)?.dishId, `dish-${SESSION_ACTION_LIMIT + 3}`);
});

test("muting a food type lower-cases it and lasts 30 days", () => {
  useFeedFeedbackStore.getState().muteFoodType("  Laksa ", 5_000);
  assert.deepEqual(useFeedFeedbackStore.getState().mutedFoodTypes, [
    { foodType: "laksa", until: 5_000 + MUTE_FOOD_TYPE_MS },
  ]);
});

test("muting the same food type again restarts the 30 days instead of duplicating it", () => {
  const { muteFoodType } = useFeedFeedbackStore.getState();
  muteFoodType("laksa", 1_000);
  muteFoodType("LAKSA", 9_000);
  const muted = useFeedFeedbackStore.getState().mutedFoodTypes;
  assert.equal(muted.length, 1);
  assert.equal(muted[0]?.until, 9_000 + MUTE_FOOD_TYPE_MS);
});

test("muting drops food types that already ended", () => {
  const { muteFoodType } = useFeedFeedbackStore.getState();
  muteFoodType("satay", 0);
  muteFoodType("laksa", MUTE_FOOD_TYPE_MS + 10);
  assert.deepEqual(
    useFeedFeedbackStore.getState().mutedFoodTypes.map((item) => item.foodType),
    ["laksa"],
  );
});

test("an empty food type is ignored", () => {
  useFeedFeedbackStore.getState().muteFoodType("   ");
  assert.deepEqual(useFeedFeedbackStore.getState().mutedFoodTypes, []);
});

test("muted food types and pinned popular dishes are kept on the device; this visit's actions are not", () => {
  const options = useFeedFeedbackStore.persist.getOptions();
  const saved = options.partialize?.({
    ...useFeedFeedbackStore.getState(),
    mutedFoodTypes: [{ foodType: "laksa", until: 1 }],
    favouriteFoodStyleIds: ["satay"],
    sessionActions: [{ dishId: "d1", kind: "open", at: 1 }],
  });
  assert.deepEqual(saved, {
    mutedFoodTypes: [{ foodType: "laksa", until: 1 }],
    favouriteFoodStyleIds: ["satay"],
  });
});

test("a different account starts with no muted food types and no session actions", async () => {
  const { useSessionStore } = await import("./useSessionStore");
  useFeedFeedbackStore.getState().muteFoodType("laksa");
  useFeedFeedbackStore.getState().recordSessionAction("d1", "save");
  useSessionStore.getState().signOut();
  assert.deepEqual(useFeedFeedbackStore.getState().mutedFoodTypes, []);
  assert.deepEqual(useFeedFeedbackStore.getState().sessionActions, []);
  assert.deepEqual(useFeedFeedbackStore.getState().favouriteFoodStyleIds, []);
});

test("a popular dish can be pinned to Home and unpinned again", () => {
  const { toggleFavouriteFoodStyle } = useFeedFeedbackStore.getState();
  toggleFavouriteFoodStyle("laksa");
  toggleFavouriteFoodStyle("satay");
  assert.deepEqual(useFeedFeedbackStore.getState().favouriteFoodStyleIds, ["laksa", "satay"]);
  toggleFavouriteFoodStyle("laksa");
  assert.deepEqual(useFeedFeedbackStore.getState().favouriteFoodStyleIds, ["satay"]);
});

test("pinned popular dishes move one place at a time and stop at the ends", () => {
  const { toggleFavouriteFoodStyle, moveFavouriteFoodStyle } = useFeedFeedbackStore.getState();
  for (const id of ["a", "b", "c"]) toggleFavouriteFoodStyle(id);
  moveFavouriteFoodStyle("c", -1);
  assert.deepEqual(useFeedFeedbackStore.getState().favouriteFoodStyleIds, ["a", "c", "b"]);
  moveFavouriteFoodStyle("a", -1);
  moveFavouriteFoodStyle("b", 1);
  moveFavouriteFoodStyle("missing", 1);
  assert.deepEqual(useFeedFeedbackStore.getState().favouriteFoodStyleIds, ["a", "c", "b"]);
  moveFavouriteFoodStyle("a", 1);
  assert.deepEqual(useFeedFeedbackStore.getState().favouriteFoodStyleIds, ["c", "a", "b"]);
});

test("resetting on sign-out also clears the pinned popular dishes", () => {
  useFeedFeedbackStore.getState().toggleFavouriteFoodStyle("laksa");
  useFeedFeedbackStore.getState()._reset();
  assert.deepEqual(useFeedFeedbackStore.getState().favouriteFoodStyleIds, []);
});
