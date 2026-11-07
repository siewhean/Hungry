import assert from "node:assert/strict";
import test from "node:test";

import {
  CONFIDENT_FROM_SIGNALS,
  LEARNING_FROM_SIGNALS,
  buildTastePalette,
  comparePalates,
  foodTypeLabel,
  learnedFromSentence,
  levelWord,
} from "@/features/profile/tastePalette";
import { stallTasteLean } from "@/features/discover/stallTaste";
import type { TasteInteractionEvent, TasteVector, UserDishAffinity } from "@/types/domain";

const NOW = Date.parse("2026-11-07T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const palate = (overrides: Partial<TasteVector> = {}): TasteVector => ({
  sweet: 5,
  spicy: 5,
  sour: 5,
  salty: 5,
  rich: 5,
  aromatic: 5,
  ...overrides,
});

function event(
  id: string,
  daysAgo: number,
  before: Partial<TasteVector>,
  after: Partial<TasteVector>,
  extra: Partial<TasteInteractionEvent> = {},
): TasteInteractionEvent {
  return {
    id,
    type: "saved",
    surface: "home",
    dishId: `dish-${id}`,
    createdAt: new Date(NOW - daysAgo * DAY).toISOString(),
    userVectorBefore: palate(before),
    userVectorAfter: palate(after),
    applied: true,
    ...extra,
  };
}

function affinity(
  foodType: string,
  evidence: number,
  absEvidence = Math.abs(evidence),
): UserDishAffinity {
  return {
    dishId: `${foodType}-${evidence}`,
    foodType,
    evidence,
    absEvidence,
    lastEventAt: new Date(NOW).toISOString(),
  };
}

test("level words run from Avoid to Love", () => {
  assert.equal(levelWord(9), "Love");
  assert.equal(levelWord(6.5), "Like");
  assert.equal(levelWord(5), "Easy either way");
  assert.equal(levelWord(3), "Go easy");
  assert.equal(levelWord(1), "Avoid");
});

test("axes are sorted strongest first with a word each", () => {
  const result = buildTastePalette({
    vector: palate({ spicy: 9, sweet: 2 }),
    events: [],
    foodHistory: [],
    now: NOW,
  });
  assert.equal(result.axes[0].key, "spicy");
  assert.equal(result.axes[0].word, "Love");
  assert.equal(result.axes[result.axes.length - 1].key, "sweet");
  assert.equal(result.axes[result.axes.length - 1].word, "Avoid");
  assert.equal(result.confidence, "starting");
  assert.equal(result.signalCount, 0);
  assert.equal(result.drift, undefined);
});

test("confidence counts applied signals and never the quiz", () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, index) => event(`e${index}`, 60, {}, {}));
  const quiz = event("quiz", 1, {}, { spicy: 9 }, { type: "quiz_completed" });
  const skipped = event("skip", 1, {}, {}, { applied: false });
  const learning = buildTastePalette({
    vector: palate(),
    events: [...many(LEARNING_FROM_SIGNALS), quiz, skipped],
    foodHistory: [],
    now: NOW,
  });
  assert.equal(learning.signalCount, LEARNING_FROM_SIGNALS);
  assert.equal(learning.confidence, "learning");
  const confident = buildTastePalette({
    vector: palate(),
    events: many(CONFIDENT_FROM_SIGNALS),
    foodHistory: [],
    now: NOW,
  });
  assert.equal(confident.confidence, "confident");
});

test("drift compares today with the palate before the oldest signal in the last 30 days", () => {
  const result = buildTastePalette({
    vector: palate({ spicy: 7 }),
    events: [
      event("old", 45, { spicy: 2 }, { spicy: 3 }),
      event("a", 20, { spicy: 5.5 }, { spicy: 6.2 }),
      event("b", 2, { spicy: 6.2 }, { spicy: 7 }),
    ],
    foodHistory: [],
    now: NOW,
  });
  assert.equal(result.drift?.key, "spicy");
  assert.equal(result.drift?.change, 1.5);
  assert.equal(result.drift?.sentence, "You have been going spicier lately.");

  const tiny = buildTastePalette({
    vector: palate({ sweet: 5.2 }),
    events: [event("a", 3, { sweet: 5 }, { sweet: 5.2 })],
    foodHistory: [],
    now: NOW,
  });
  assert.equal(tiny.drift, undefined, "a move under half a point is noise");
});

test("shaped by lists the newest five signals with a dish, the action and the taste moved", () => {
  const events = [
    event("1", 1, { rich: 5 }, { rich: 5.6 }, { type: "dish_like" }),
    event("2", 2, { spicy: 6 }, { spicy: 5.4 }, { type: "dismissed" }),
    event("3", 3, {}, {}, { type: "review", rating: 5 }),
    event("4", 4, {}, {}, { dishId: undefined }),
    event("5", 5, {}, {}),
    event("6", 6, {}, {}),
    event("7", 7, {}, {}),
  ];
  const result = buildTastePalette({ vector: palate(), events, foodHistory: [], now: NOW });
  assert.deepEqual(
    result.shapedBy.map((shaper) => shaper.id),
    ["1", "2", "3", "5", "6"],
  );
  assert.equal(result.shapedBy[0].action, "Liked");
  assert.deepEqual(result.shapedBy[0].moved, {
    key: "rich",
    label: result.shapedBy[0].moved?.label,
    change: 0.6,
  });
  assert.equal(result.shapedBy[1].action, "Not for me");
  assert.equal(result.shapedBy[1].moved?.change, -0.6);
  assert.equal(result.shapedBy[2].action, "Rated 5 stars");
  assert.equal(result.shapedBy[2].moved, undefined);
});

test("loves and skips come from food history per food type, shrunk by evidence", () => {
  const result = buildTastePalette({
    vector: palate(),
    events: [],
    foodHistory: [
      affinity("laksa", 4),
      affinity("Laksa", 2),
      affinity("chicken_rice", 1),
      affinity("durian", -3),
      affinity("", 9),
    ],
    now: NOW,
  });
  assert.deepEqual(
    result.loves.map((row) => row.label),
    ["Laksa", "Chicken rice"],
  );
  assert.equal(result.loves[0].score, 0.75);
  assert.deepEqual(
    result.skips.map((row) => row.label),
    ["Durian"],
  );
});

test("try next skips food already tried and never pushes heat at someone who avoids it", () => {
  const spiceAverse = buildTastePalette({
    vector: palate({ spicy: 2 }),
    events: [],
    foodHistory: [affinity("chicken rice", 2)],
    now: NOW,
  });
  assert.ok(spiceAverse.tryNext.length <= 4);
  for (const row of spiceAverse.tryNext) {
    assert.notEqual(row.foodType, "chicken rice");
    assert.ok((stallTasteLean(row.label)?.spicy ?? 0) < 6, `${row.label} is too hot`);
  }
  const scores = spiceAverse.tryNext.map((row) => row.score);
  assert.deepEqual(
    scores,
    [...scores].sort((a, b) => b - a),
  );
});

test("sentences and labels", () => {
  assert.match(learnedFromSentence(0), /taste quiz/);
  assert.equal(
    learnedFromSentence(1),
    "Learned from 1 thing you saved, liked, reviewed or turned down.",
  );
  assert.match(learnedFromSentence(14), /^Learned from 14 things/);
  assert.equal(foodTypeLabel("char_kway-teow"), "Char kway teow");
  assert.equal(foodTypeLabel("  "), "");
});

test("compare palates: differences first, biggest gap first, then what you share", () => {
  const result = comparePalates(
    palate({ spicy: 3, sweet: 8, rich: 6 }),
    palate({ spicy: 9, sweet: 8.4, rich: 4.5 }),
    "Mei",
  );
  assert.deepEqual(
    result.different.map((row) => row.key),
    ["spicy", "rich"],
  );
  assert.equal(result.different[0].sentence, "Mei likes far more spice");
  assert.equal(result.different[1].sentence, "You like more richness");
  const sweet = result.shared.find((row) => row.key === "sweet");
  assert.equal(sweet?.sentence, "You both love sweetness");
  const sour = result.shared.find((row) => row.key === "sour");
  assert.equal(sour?.sentence, "About the same on sourness");
  assert.equal(result.rows.length, 6);
  assert.equal(result.rows[0].key, "spicy");
  const easy = comparePalates(palate({ salty: 2 }), palate({ salty: 2.5 }), "Mei");
  assert.equal(
    easy.shared.find((row) => row.key === "salty")?.sentence,
    "You both go easy on saltiness",
  );
});
