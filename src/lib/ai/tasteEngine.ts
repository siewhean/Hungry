/**
 * AI Taste Engine
 *
 * Implements cosine similarity between user taste vectors and dish taste vectors.
 * Also includes community calibration: every review nudges both the reviewer's
 * taste profile and the dish's community-rated taste vector.
 *
 * Taste dimensions: sweet | spicy | sour | salty | rich | aromatic
 * Scale: 0–10
 */

import type { TasteVector } from "@/types/domain";

// ─── Vector math ──────────────────────────────────────────────────────────────

export function dotProduct(a: TasteVector, b: TasteVector): number {
  return (
    a.sweet * b.sweet +
    a.spicy * b.spicy +
    a.sour * b.sour +
    a.salty * b.salty +
    a.rich * b.rich +
    a.aromatic * b.aromatic
  );
}

export function magnitude(v: TasteVector): number {
  return Math.sqrt(dotProduct(v, v));
}

/**
 * Cosine similarity in [0, 1].
 * Returns 0 when either vector is zero (no preferences locked in).
 */
export function cosineSimilarity(a: TasteVector, b: TasteVector): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

/**
 * Euclidean distance (lower = more similar).
 * Useful for absolute difference, not just directional match.
 */
export function euclideanDistance(a: TasteVector, b: TasteVector): number {
  return Math.sqrt(
    (a.sweet - b.sweet) ** 2 +
      (a.spicy - b.spicy) ** 2 +
      (a.sour - b.sour) ** 2 +
      (a.salty - b.salty) ** 2 +
      (a.rich - b.rich) ** 2 +
      (a.aromatic - b.aromatic) ** 2
  );
}

/**
 * Blended score: 70% cosine similarity + 30% inverse euclidean distance.
 * Gives a combined [0,1] match score.
 */
export function blendedMatchScore(user: TasteVector, dish: TasteVector): number {
  const cos = cosineSimilarity(user, dish);
  const maxDist = Math.sqrt(6 * 10 ** 2); // max possible distance
  const normDist = 1 - euclideanDistance(user, dish) / maxDist;
  return 0.7 * cos + 0.3 * normDist;
}

// ─── Recommendation ───────────────────────────────────────────────────────────

export interface ScoredDish {
  dishId: string;
  score: number;        // [0, 1]
  matchPercent: number; // 0–100 rounded
  explanation: string;  // human-readable reason
}

/**
 * Rank an array of dishes by taste match against the user's vector.
 */
export function rankDishes(
  user: TasteVector,
  dishes: Array<{ id: string; tasteVector: TasteVector; name: string }>
): ScoredDish[] {
  return dishes
    .map((dish) => {
      const score = blendedMatchScore(user, dish.tasteVector);
      const explanation = buildExplanation(user, dish.tasteVector, dish.name);
      return {
        dishId: dish.id,
        score,
        matchPercent: Math.round(score * 100),
        explanation,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Explain why a dish matches (top 2 matching dimensions).
 */
function buildExplanation(user: TasteVector, dish: TasteVector, name: string): string {
  const dims: Array<{ key: keyof TasteVector; label: string }> = [
    { key: "sweet", label: "sweetness" },
    { key: "spicy", label: "heat" },
    { key: "sour", label: "tang" },
    { key: "salty", label: "savoriness" },
    { key: "rich", label: "richness" },
    { key: "aromatic", label: "aroma" },
  ];

  const matched = dims
    .map((d) => ({
      label: d.label,
      diff: Math.abs(user[d.key] - dish[d.key]),
      userVal: user[d.key],
    }))
    .filter((d) => d.userVal >= 5) // user actually cares about this dimension
    .sort((a, b) => a.diff - b.diff) // closest match first
    .slice(0, 2);

  if (matched.length === 0) return `${name} is a crowd favourite.`;
  if (matched.length === 1)
    return `Matches your love of ${matched[0].label}.`;
  return `Matches your ${matched[0].label} and ${matched[1].label} preferences.`;
}

// ─── Community calibration ────────────────────────────────────────────────────

/**
 * After a user submits a review with a taste impression,
 * nudge both the user's profile and the dish's community vector.
 *
 * alpha = learning rate (suggest 0.05 for user, 0.1 for dish community)
 */
export function calibrateVector(
  current: TasteVector,
  impression: TasteVector,
  alpha = 0.05
): TasteVector {
  return {
    sweet: clamp(current.sweet + alpha * (impression.sweet - current.sweet), 0, 10),
    spicy: clamp(current.spicy + alpha * (impression.spicy - current.spicy), 0, 10),
    sour: clamp(current.sour + alpha * (impression.sour - current.sour), 0, 10),
    salty: clamp(current.salty + alpha * (impression.salty - current.salty), 0, 10),
    rich: clamp(current.rich + alpha * (impression.rich - current.rich), 0, 10),
    aromatic: clamp(current.aromatic + alpha * (impression.aromatic - current.aromatic), 0, 10),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Decide-for-me ────────────────────────────────────────────────────────────

/**
 * Pick the single best dish for a user from a dataset.
 * Applies a minimum score threshold so we don't return irrelevant dishes.
 */
export function decideForMe(
  user: TasteVector,
  dishes: Array<{ id: string; tasteVector: TasteVector; name: string }>,
  minScore = 0.4
): { dishId: string; matchPercent: number; explanation: string } | null {
  const ranked = rankDishes(user, dishes);
  const top = ranked.find((d) => d.score >= minScore);
  if (!top) return null;
  return {
    dishId: top.dishId,
    matchPercent: top.matchPercent,
    explanation: top.explanation,
  };
}

// ─── Taste vector from quiz answers ──────────────────────────────────────────

/**
 * Convert raw quiz slider values (0–10) to a TasteVector.
 */
export function buildTasteVectorFromQuiz(answers: Record<string, number>): TasteVector {
  return {
    sweet: clamp(answers.sweet ?? 5, 0, 10),
    spicy: clamp(answers.spicy ?? 5, 0, 10),
    sour: clamp(answers.sour ?? 5, 0, 10),
    salty: clamp(answers.salty ?? 5, 0, 10),
    rich: clamp(answers.rich ?? 5, 0, 10),
    aromatic: clamp(answers.aromatic ?? 5, 0, 10),
  };
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export const TASTE_EMOJIS: Record<keyof TasteVector, string> = {
  sweet: "🍯",
  spicy: "🌶️",
  sour: "🍋",
  salty: "🧂",
  rich: "🥩",
  aromatic: "🌿",
};

export const TASTE_COLORS: Record<keyof TasteVector, string> = {
  sweet: "#F59E0B",
  spicy: "#EF4444",
  sour: "#84CC16",
  salty: "#60A5FA",
  rich: "#A855F7",
  aromatic: "#10B981",
};
