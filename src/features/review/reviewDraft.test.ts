import test from "node:test";
import assert from "node:assert/strict";

import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { createClientReviewId, createInitialReviewDraft } from "./reviewDraft";

test("initial review draft defaults to not recommended", () => {
  const draft = createInitialReviewDraft();

  assert.equal(draft.recommend, false);
  assert.equal(draft.rating, 0);
  assert.equal(draft.text, "");
  assert.deepEqual(draft.selectedTags, []);
});

test("initial review draft factory returns a fresh object", () => {
  const first = createInitialReviewDraft();
  const second = createInitialReviewDraft();

  first.selectedTags.push("Spicy");
  assert.deepEqual(second.selectedTags, []);
});

test("client review ids are RFC 4122 v4 uuids and unique", () => {
  const first = createClientReviewId();
  const second = createClientReviewId();
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(first, second);
});

test("selecting the same dish keeps the draft; a different dish resets it", () => {
  const store = useReviewDraftStore;
  store.getState().resetDraft();
  store.getState().selectDish("venue-a", "dish-a");
  store.getState().setRating(4);
  store.getState().setText("Great broth");
  const pendingId = store.getState().ensurePendingReviewId();
  const draftBefore = store.getState().draft;

  store.getState().selectDish("venue-a", "dish-a");
  assert.equal(store.getState().draft, draftBefore);
  assert.equal(store.getState().draft.rating, 4);
  assert.equal(store.getState().ensurePendingReviewId(), pendingId);

  store.getState().selectDish("venue-a", "dish-b");
  assert.equal(store.getState().draft.selectedDishId, "dish-b");
  assert.equal(store.getState().draft.rating, 0);
  assert.equal(store.getState().pendingReviewId, undefined);

  store.getState().resetDraft();
});
