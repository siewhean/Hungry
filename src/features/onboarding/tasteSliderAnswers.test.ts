import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import {
  answerTaste,
  canSkipRest,
  draftFromSavedVector,
  draftFromStoredQuiz,
  emptyTasteDraft,
  isTasteAnswered,
  liveTasteLine,
  skipRemainingTastes,
  skipTaste,
  tasteVectorFromDraft,
  wasTasteSkipped,
} from "./tasteSliderAnswers";

test("a new draft is all neutral and nothing is answered", () => {
  const draft = emptyTasteDraft();
  assert.deepEqual(draft.values, NEUTRAL_TASTE_VECTOR);
  assert.deepEqual(draft.answered, []);
  assert.equal(wasTasteSkipped(draft), true);
});

test("answering snaps to a stop, marks the taste answered and leaves the draft untouched", () => {
  const start = emptyTasteDraft();
  const next = answerTaste(start, "spicy", 6.4);
  assert.equal(next.values.spicy, 7.5);
  assert.deepEqual(next.answered, ["spicy"]);
  assert.equal(start.values.spicy, 5, "the old draft is not mutated");
  assert.deepEqual(answerTaste(next, "spicy", 0).answered, ["spicy"], "no duplicates");
});

test("skipping puts the taste back to average and marks it not set, even after an answer", () => {
  const answered = answerTaste(emptyTasteDraft(), "sweet", 10);
  const skipped = skipTaste(answered, "sweet");
  assert.equal(skipped.values.sweet, 5);
  assert.equal(isTasteAnswered(skipped, "sweet"), false);
});

test("skip the rest keeps answered tastes and leaves the others not set", () => {
  let draft = emptyTasteDraft();
  draft = answerTaste(draft, "spicy", 10);
  draft = answerTaste(draft, "rich", 0);
  const rest = skipRemainingTastes(draft, 3);
  assert.deepEqual(rest.answered, ["spicy", "rich"]);
  assert.equal(rest.values.rich, 0);
  assert.equal(rest.values.sour, 5);
});

test("the saved vector has answered tastes as chosen and everything else neutral", () => {
  let draft = answerTaste(emptyTasteDraft(), "spicy", 2.5);
  draft = { ...draft, values: { ...draft.values, sweet: 10 } };
  assert.deepEqual(tasteVectorFromDraft(draft), { ...NEUTRAL_TASTE_VECTOR, spicy: 2.5 });
  assert.equal(wasTasteSkipped(draft), false);
});

test("a retake starts from the saved vector with every taste answered", () => {
  const draft = draftFromSavedVector({ ...NEUTRAL_TASTE_VECTOR, spicy: 8, sweet: 2 });
  assert.equal(draft.values.spicy, 7.5);
  assert.equal(draft.values.sweet, 2.5);
  assert.equal(draft.answered.length, 6);
});

test("skip the rest shows from the fourth question up to the fifth, not on the last", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(canSkipRest), [false, false, false, true, true, false]);
});

test("the live line shows how a standard dish feels to this person", () => {
  assert.equal(
    liveTasteLine("spicy", 0),
    "A standard laksa is 6/10 spicy. It will feel like 10/10 to you.",
  );
  assert.equal(
    liveTasteLine("spicy", 5),
    "A standard laksa is 6/10 spicy. It will feel like 6/10 to you.",
  );
  assert.match(liveTasteLine("spicy", 10), /feel like 3\/10 to you/);
});

test("a draft left mid-quiz comes back with only its answered tastes, moved to the new stops", () => {
  const draft = draftFromStoredQuiz({
    answers: { ...NEUTRAL_TASTE_VECTOR, spicy: 8, sweet: 2, rich: 9 },
    answeredKeys: ["spicy", "sweet"],
  });
  assert.deepEqual(draft.answered, ["spicy", "sweet"]);
  assert.equal(draft.values.spicy, 7.5);
  assert.equal(draft.values.sweet, 2.5);
  assert.equal(draft.values.rich, 5, "an unanswered taste stays at average");
  assert.equal(
    wasTasteSkipped(draftFromStoredQuiz({ answers: NEUTRAL_TASTE_VECTOR, answeredKeys: [] })),
    true,
  );
});
