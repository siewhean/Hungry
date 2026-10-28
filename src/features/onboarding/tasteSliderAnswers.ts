import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { perceivedTasteLevel } from "@/features/detail/perceivedTaste";
import type { TasteKey, TasteVector } from "@/types/domain";
import {
  NEUTRAL_SLIDER_VALUE,
  SKIP_REST_FROM_INDEX,
  TASTE_SLIDER_AXES,
  TASTE_SLIDER_ORDER,
  snapToStop,
  stopForSavedAnswer,
} from "./tasteSliderStops";

/**
 * What the taste sliders hold while the person is answering. Nothing is saved until the last
 * question, so backing out discards the draft. A taste that is not in `answered` is "not set": it
 * keeps the neutral 5, so ranking treats it as average and nobody gets a made-up answer.
 */
export type TasteDraft = {
  values: TasteVector;
  answered: readonly TasteKey[];
};

export function emptyTasteDraft(): TasteDraft {
  return { values: { ...NEUTRAL_TASTE_VECTOR }, answered: [] };
}

/**
 * Picks up a draft the person left mid-quiz (the draft store keeps answers, which ones were
 * answered, and the question they were on). Old 2/5/8 answers move to the nearest stop.
 */
export function draftFromStoredQuiz(stored: {
  answers: TasteVector;
  answeredKeys: readonly TasteKey[];
}): TasteDraft {
  const values = { ...NEUTRAL_TASTE_VECTOR };
  const answered = TASTE_SLIDER_ORDER.filter((key) => stored.answeredKeys.includes(key));
  for (const key of answered) values[key] = stopForSavedAnswer(stored.answers[key]);
  return { values, answered };
}

/** A retake from Profile starts from the saved vector, with every taste counted as answered. */
export function draftFromSavedVector(vector: TasteVector): TasteDraft {
  const values = { ...NEUTRAL_TASTE_VECTOR };
  for (const key of TASTE_SLIDER_ORDER) values[key] = stopForSavedAnswer(vector[key]);
  return { values, answered: [...TASTE_SLIDER_ORDER] };
}

/** The person moved the thumb or tapped a stop: the value snaps to a stop and the taste is answered. */
export function answerTaste(draft: TasteDraft, key: TasteKey, value: number): TasteDraft {
  return {
    values: { ...draft.values, [key]: snapToStop(value) },
    answered: draft.answered.includes(key) ? draft.answered : [...draft.answered, key],
  };
}

/** "Skip for now": the taste goes back to average and is marked not set, even if answered before. */
export function skipTaste(draft: TasteDraft, key: TasteKey): TasteDraft {
  return {
    values: { ...draft.values, [key]: NEUTRAL_SLIDER_VALUE },
    answered: draft.answered.filter((answeredKey) => answeredKey !== key),
  };
}

/**
 * "Skip the rest, use my defaults": every taste from this question on that was not answered stays
 * not set. Tastes already answered are kept.
 */
export function skipRemainingTastes(draft: TasteDraft, fromIndex: number): TasteDraft {
  let next = draft;
  for (const key of TASTE_SLIDER_ORDER.slice(fromIndex)) {
    if (!next.answered.includes(key)) next = skipTaste(next, key);
  }
  return next;
}

export function isTasteAnswered(draft: TasteDraft, key: TasteKey): boolean {
  return draft.answered.includes(key);
}

/** The vector to save: answered tastes as chosen, everything else neutral. */
export function tasteVectorFromDraft(draft: TasteDraft): TasteVector {
  const vector = { ...NEUTRAL_TASTE_VECTOR };
  for (const key of draft.answered) vector[key] = draft.values[key];
  return vector;
}

/** No answered taste at all means the taste part was skipped, not "everything balanced". */
export function wasTasteSkipped(draft: TasteDraft): boolean {
  return draft.answered.length === 0;
}

/** The "Skip the rest" link shows from the fourth question on. */
export function canSkipRest(questionIndex: number): boolean {
  return questionIndex >= SKIP_REST_FROM_INDEX && questionIndex < TASTE_SLIDER_ORDER.length - 1;
}

/**
 * The line under the slider: how a typical dish on this axis would feel to this person.
 * "A standard laksa is 6/10 spicy. It will feel like 8.4/10 to you."
 */
export function liveTasteLine(key: TasteKey, value: number): string {
  const axis = TASTE_SLIDER_AXES[key];
  const { dish, standard } = axis.reference;
  const felt = perceivedTasteLevel(standard, value);
  return `A standard ${dish} is ${standard}/10 ${axis.adjective}. It will feel like ${felt}/10 to you.`;
}
