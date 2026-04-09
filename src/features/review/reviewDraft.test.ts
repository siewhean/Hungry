import test from "node:test";
import assert from "node:assert/strict";

import { createInitialReviewDraft } from "./reviewDraft";

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
