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

import type {
  TasteVector,
  DietaryFlag,
  DishSummary,
  FoodOpenness,
  HawkerTasteTag,
  RecommendationBucket,
} from "@/types/domain";

// ═══════════════════════════════════════════════════════════════════════════════
// EXTENDED RECOMMENDATION PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

import { filterSafeDishes } from "./dietaryGate";
import { applyContextModifier, computeContextModifier, getCurrentContext } from "./contextEngine";
import type { ContextState } from "./contextEngine";
import { hasLikedHistory, type FoodHistory } from "./foodHistory";
import {
  allocateByBuckets,
  bucketExplanation,
  buildLikedProfile,
  neophiliaToOpenness,
} from "./exploration";

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
      (a.aromatic - b.aromatic) ** 2,
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
  score: number; // [0, 1]
  matchPercent: number; // 0–100 rounded
  explanation: string; // human-readable reason
}

/**
 * Rank an array of dishes by taste match against the user's vector.
 */
export function rankDishes(
  user: TasteVector,
  dishes: { id: string; tasteVector: TasteVector; name: string }[],
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
  const dims: { key: keyof TasteVector; label: string }[] = [
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
  if (matched.length === 1) return `Matches your love of ${matched[0].label}.`;
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
  alpha = 0.05,
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

export function averageTasteVectors(vectors: TasteVector[], fallback: TasteVector): TasteVector {
  if (vectors.length === 0) return fallback;

  const total = vectors.reduce(
    (sum, vector) => ({
      sweet: sum.sweet + vector.sweet,
      spicy: sum.spicy + vector.spicy,
      sour: sum.sour + vector.sour,
      salty: sum.salty + vector.salty,
      rich: sum.rich + vector.rich,
      aromatic: sum.aromatic + vector.aromatic,
    }),
    { sweet: 0, spicy: 0, sour: 0, salty: 0, rich: 0, aromatic: 0 } satisfies TasteVector,
  );

  return {
    sweet: clamp(total.sweet / vectors.length, 0, 10),
    spicy: clamp(total.spicy / vectors.length, 0, 10),
    sour: clamp(total.sour / vectors.length, 0, 10),
    salty: clamp(total.salty / vectors.length, 0, 10),
    rich: clamp(total.rich / vectors.length, 0, 10),
    aromatic: clamp(total.aromatic / vectors.length, 0, 10),
  };
}

// ─── Decide-for-me ────────────────────────────────────────────────────────────

/**
 * Pick the single best dish for a user from a dataset.
 * Applies a minimum score threshold so we don't return irrelevant dishes.
 */
export function decideForMe(
  user: TasteVector,
  dishes: { id: string; tasteVector: TasteVector; name: string }[],
  minScore = 0.4,
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

export const TASTE_LABELS: Record<keyof TasteVector, string> = {
  sweet: "Sweet",
  spicy: "Spicy",
  sour: "Sour",
  salty: "Salty",
  rich: "Rich",
  aromatic: "Aromatic",
};

export const TASTE_COLORS: Record<keyof TasteVector, string> = {
  sweet: "#F59E0B",
  spicy: "#EF4444",
  sour: "#84CC16",
  salty: "#60A5FA",
  rich: "#A855F7",
  aromatic: "#10B981",
};

// ─── Pipeline Types ───────────────────────────────────────────────────────────

export interface PipelineContext {
  /** User's core taste vector */
  userVector: TasteVector;
  /** User's dietary restrictions */
  dietaryFlags: DietaryFlag[];
  /** User's neophilia index (0–10) — controls serendipity injection */
  neophiliaIndex: number;
  /** GPS location (optional) */
  latitude?: number;
  longitude?: number;
  /** Maximum distance in meters */
  radiusMeters?: number;
  /** Dish IDs to exclude (already seen / dismissed) */
  excludeDishIds?: string[];
  /** Environmental context (time-of-day, weather) */
  context?: ContextState;
  /** Dishes the user liked (favourites, onboarding picks); their tags form a light secondary match */
  likedDishIds?: string[];
  /** How open the user is to new food; defaults from neophiliaIndex */
  openness?: FoodOpenness;
  /** What the user ate or liked before; with liked dishes, stage 4 mixes familiar and new food by openness */
  history?: FoodHistory;
}

export interface PipelineResult {
  dishId: string;
  /** Multi-signal precision score, 0–1 */
  score: number;
  /** Human-readable percentage */
  matchPercent: number;
  /** Explanation of why this dish was recommended */
  explanation: string;
  /** Whether this dish was injected for serendipity */
  isSerendipitous: boolean;
  /** Why the dish is in the slate; set only when food history drives stage 4 */
  bucket?: RecommendationBucket;
}

export const RECOMMENDATION_SCORE_WEIGHTS = {
  taste: 0.5,
  context: 0.15,
  distance: 0.15,
  rating: 0.1,
  novelty: 0.1,
} as const;

/** Candidates kept after stage 2 when food history drives stage 4. */
const HISTORY_CANDIDATE_POOL = 600;

/** Share of the taste score that comes from flavour/cuisine tag overlap when the user has liked dishes. */
export const TAG_MATCH_WEIGHT = 0.2;

function dishTags(dish: DishSummary): string[] {
  const tags = [...dish.tasteTags, ...(dish.foodTypeTag ? [dish.foodTypeTag] : [])];
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

/** Tag -> 0-1 affinity, from how often each tag appears across the user's liked dishes. */
export function buildTagAffinity(likedDishes: DishSummary[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const dish of likedDishes) {
    for (const tag of dishTags(dish)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const max = Math.max(0, ...counts.values());
  return new Map([...counts].map(([tag, count]) => [tag, count / max]));
}

/** 0-1: summed affinity of the dish's tags, capped at 1. */
export function tagMatchScore(dish: DishSummary, affinity: Map<string, number>): number {
  const total = dishTags(dish).reduce((sum, tag) => sum + (affinity.get(tag) ?? 0), 0);
  return Math.min(1, total);
}

// ─── Stage 1: Hard Filter (Dietary Gate) ──────────────────────────────────────

/**
 * SAFETY-CRITICAL: Purge all dishes that conflict with user's dietary flags.
 * This function runs FIRST — the AI engine never sees unsafe dishes.
 */
function stage1HardFilter<T extends DishSummary>(dishes: T[], userFlags: DietaryFlag[]): T[] {
  return filterSafeDishes(dishes, userFlags);
}

// ─── Stage 2: Candidate Generation ────────────────────────────────────────────

/**
 * Rapidly narrow the safe pool to the top N candidates by cosine similarity.
 * In production, this maps to pgvector's HNSW nearest-neighbor search.
 */
function stage2CandidateGeneration<T extends DishSummary>(
  dishes: T[],
  userVector: TasteVector,
  topN = 50,
): (T & { _rawScore: number })[] {
  return dishes
    .map((dish) => ({
      ...dish,
      _rawScore: blendedMatchScore(userVector, dish.tasteVector),
    }))
    .sort((a, b) => b._rawScore - a._rawScore)
    .slice(0, topN);
}

// ─── Stage 3: Precision Scoring ───────────────────────────────────────────────

/**
 * Multi-signal weighted scoring combining taste match, context, distance,
 * community rating, and implicit behavior signals.
 *
 * Weights:
 *   50% — Taste match (blended cosine + euclidean, 20% tag overlap when likedDishIds given)
 *   15% — Contextual relevance (time-of-day modifier)
 *   15% — Distance proximity (inverse normalized)
 *   10% — Community rating (normalized)
 *   10% — Novelty/diversity readiness
 *
 * A dish's taste weight is scaled by its tasteConfidence; the weight it loses
 * moves to distance and rating in equal halves, so weights still sum to 1.
 */
function stage3PrecisionScoring<T extends DishSummary & { _rawScore: number }>(
  candidates: T[],
  contextVector: TasteVector,
  userVector: TasteVector,
  tagAffinity: Map<string, number> = new Map(),
): (T & { _precisionScore: number })[] {
  // Find max distance for normalization
  const maxDist = Math.max(...candidates.map((d) => d.distanceMeters), 1);

  return candidates.map((dish) => {
    // Vector match from Stage 2, lightly blended with tag overlap so dishes with
    // similar vectors but different character (laksa vs bak kut teh) separate.
    const tasteScore =
      tagAffinity.size > 0
        ? (1 - TAG_MATCH_WEIGHT) * dish._rawScore +
          TAG_MATCH_WEIGHT * tagMatchScore(dish, tagAffinity)
        : dish._rawScore;
    const contextScore = blendedMatchScore(contextVector, dish.tasteVector);
    const distanceScore = 1 - dish.distanceMeters / maxDist;
    const ratingScore = (dish.rating ?? 0) / 5;
    const noveltyScore = isWildCardScore(tasteScore) ? 1 : 0.5;

    const confidence = Math.min(1, Math.max(0, dish.tasteConfidence ?? 1));
    const shiftedWeight = RECOMMENDATION_SCORE_WEIGHTS.taste * (1 - confidence);

    const precisionScore =
      RECOMMENDATION_SCORE_WEIGHTS.taste * confidence * tasteScore +
      RECOMMENDATION_SCORE_WEIGHTS.context * contextScore +
      (RECOMMENDATION_SCORE_WEIGHTS.distance + shiftedWeight / 2) * distanceScore +
      (RECOMMENDATION_SCORE_WEIGHTS.rating + shiftedWeight / 2) * ratingScore +
      RECOMMENDATION_SCORE_WEIGHTS.novelty * noveltyScore;

    return { ...dish, _precisionScore: precisionScore };
  });
}

// ─── Stage 4: Serendipity Re-Ranking ──────────────────────────────────────────

/**
 * Inject novel dishes based on the user's neophilia index.
 * Serendipitous dishes are NOT random — they must share flavor chemistry
 * with the user's known favorites (≥ 0.3 cosine similarity).
 *
 * neophiliaIndex mapping:
 *   0–3: 5% serendipity (safe zone — mostly familiar)
 *   4–6: 15% serendipity (occasional novelty)
 *   7–10: 30% serendipity (actively inject the unfamiliar)
 */
function stage4SerendipityReRanking<T extends DishSummary & { _precisionScore: number }>(
  ranked: T[],
  neophiliaIndex: number,
  userVector: TasteVector,
  allSafeDishes: DishSummary[],
): PipelineResult[] {
  const serendipityRate = neophiliaIndex <= 3 ? 0.05 : neophiliaIndex <= 6 ? 0.15 : 0.3;

  const topN = Math.min(ranked.length, 20);
  const serendipitySlots = Math.floor(topN * serendipityRate);
  const regularSlots = topN - serendipitySlots;

  // Regular top-scored dishes
  const regularResults = ranked.slice(0, regularSlots);
  const regularIds = new Set(regularResults.map((d) => d.id));

  // Serendipitous dishes: from the safe pool but NOT in the top regulars
  // Must have minimum flavor overlap (cosine ≥ 0.3 with user vector)
  const novelCandidates = allSafeDishes
    .filter((d) => !regularIds.has(d.id) && cosineSimilarity(userVector, d.tasteVector) >= 0.3)
    .sort((left, right) => stableDishNoise(left.id) - stableDishNoise(right.id))
    .slice(0, serendipitySlots);

  // Build final results
  const results: PipelineResult[] = [
    ...regularResults.map((d) => ({
      dishId: d.id,
      score: d._precisionScore,
      matchPercent: Math.round(d._precisionScore * 100),
      explanation: buildExplanation(userVector, d.tasteVector, d.name),
      isSerendipitous: false,
    })),
    ...novelCandidates.map((d) => ({
      dishId: d.id,
      score: cosineSimilarity(userVector, d.tasteVector),
      matchPercent: Math.round(cosineSimilarity(userVector, d.tasteVector) * 100),
      explanation: `Something new — try ${d.name}?`,
      isSerendipitous: true,
    })),
  ];

  return results;
}

function stableDishNoise(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 9973;
  }
  return hash / 9973;
}

const TASTE_KEYS: (keyof TasteVector)[] = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"];

function getDominantTasteDimension(vector: TasteVector): keyof TasteVector {
  let dominant: keyof TasteVector = TASTE_KEYS[0];
  for (const key of TASTE_KEYS) {
    if (vector[key] > vector[dominant]) {
      dominant = key;
    }
  }
  return dominant;
}

function isWildCardScore(score: number): boolean {
  return score >= 0.4 && score <= 0.6;
}

function mutateCount(map: Map<string, number>, key: string, delta: number) {
  const next = (map.get(key) ?? 0) + delta;
  if (next <= 0) {
    map.delete(key);
    return;
  }
  map.set(key, next);
}

function diversifyResults(
  results: PipelineResult[],
  dishesById: Map<string, DishSummary>,
): PipelineResult[] {
  const selected: PipelineResult[] = [];
  const selectedIds = new Set<string>();
  const venueCounts = new Map<string, number>();
  const dimensionCounts = new Map<string, number>();
  let hasWildCard = false;

  const canSelectDish = (dish: DishSummary) => {
    const dominant = getDominantTasteDimension(dish.tasteVector);
    const venueCount = venueCounts.get(dish.venueId) ?? 0;
    const dimensionCount = dimensionCounts.get(dominant) ?? 0;
    return venueCount < 3 && dimensionCount < 2;
  };

  const addDishCounts = (dish: DishSummary) => {
    const dominant = getDominantTasteDimension(dish.tasteVector);
    mutateCount(venueCounts, dish.venueId, 1);
    mutateCount(dimensionCounts, dominant, 1);
  };

  const removeDishCounts = (dish: DishSummary) => {
    const dominant = getDominantTasteDimension(dish.tasteVector);
    mutateCount(venueCounts, dish.venueId, -1);
    mutateCount(dimensionCounts, dominant, -1);
  };

  for (const result of results) {
    if (selected.length >= 20) {
      break;
    }
    if (selectedIds.has(result.dishId)) {
      continue;
    }
    const dish = dishesById.get(result.dishId);
    if (!dish || !canSelectDish(dish)) {
      continue;
    }

    selected.push(result);
    selectedIds.add(result.dishId);
    addDishCounts(dish);
    if (isWildCardScore(result.score)) {
      hasWildCard = true;
    }
  }

  if (hasWildCard || selected.length === 0) {
    return selected;
  }

  for (const candidate of results) {
    if (!isWildCardScore(candidate.score) || selectedIds.has(candidate.dishId)) {
      continue;
    }
    const candidateDish = dishesById.get(candidate.dishId);
    if (!candidateDish) {
      continue;
    }

    for (let index = selected.length - 1; index >= 0; index -= 1) {
      const existing = selected[index];
      const existingDish = dishesById.get(existing.dishId);
      if (!existingDish) {
        continue;
      }

      removeDishCounts(existingDish);
      const canReplace = canSelectDish(candidateDish);
      if (!canReplace) {
        addDishCounts(existingDish);
        continue;
      }

      selected[index] = candidate;
      selectedIds.delete(existing.dishId);
      selectedIds.add(candidate.dishId);
      addDishCounts(candidateDish);
      return selected;
    }
  }

  return selected;
}

// ─── Full Pipeline ────────────────────────────────────────────────────────────

/**
 * Execute the complete 4-stage recommendation pipeline.
 *
 * Stage 1: Dietary Hard Filter (safety gate)
 * Stage 2: Candidate Generation (cosine similarity top-N)
 * Stage 3: Precision Scoring (multi-signal weighted)
 * Stage 4: Serendipity Re-Ranking (neophilia-gated novelty injection)
 */
export function runRecommendationPipeline(
  allDishes: DishSummary[],
  ctx: PipelineContext,
): PipelineResult[] {
  // Resolve context
  const context = ctx.context ?? getCurrentContext();
  const contextModifier = computeContextModifier(context);
  const contextVector = applyContextModifier(ctx.userVector, contextModifier);

  // Stage 1: Remove unsafe dishes
  const safeDishes = stage1HardFilter(allDishes, ctx.dietaryFlags);

  // Apply exclusions and radius filter
  let candidates = safeDishes.filter((d) => {
    if (ctx.excludeDishIds?.includes(d.id)) return false;
    if (ctx.radiusMeters && d.distanceMeters > ctx.radiusMeters) return false;
    return true;
  });

  const history = hasLikedHistory(ctx.history) ? ctx.history : undefined;
  if (history) {
    candidates = candidates.filter((d) => !history.dismissedDishIds.has(d.id));
  }

  if (candidates.length === 0) return [];

  // Stage 2: Narrow to top candidates by taste match. With history the familiar and
  // same-food buckets need dishes outside the taste top 50, so keep a wider pool.
  const topCandidates = stage2CandidateGeneration(
    candidates,
    contextVector,
    history ? HISTORY_CANDIDATE_POOL : 50,
  );

  // Stage 3: Multi-signal precision scoring
  const likedIds = new Set([...(ctx.likedDishIds ?? []), ...(history?.likedDishIds ?? [])]);
  const tagAffinity = buildTagAffinity(allDishes.filter((dish) => likedIds.has(dish.id)));
  const precisionRanked = stage3PrecisionScoring(
    topCandidates,
    contextVector,
    ctx.userVector,
    tagAffinity,
  );

  // Sort by precision score
  precisionRanked.sort((a, b) => b._precisionScore - a._precisionScore);

  const dishesById = new Map(candidates.map((dish) => [dish.id, dish]));

  // Stage 4 with history: mix familiar and new food by the user's openness.
  if (history) {
    const allocated = allocateByBuckets(
      precisionRanked.map((dish) => ({ dish, score: dish._precisionScore })),
      {
        openness: ctx.openness ?? neophiliaToOpenness(ctx.neophiliaIndex),
        history,
        liked: buildLikedProfile(allDishes.filter((dish) => likedIds.has(dish.id))),
      },
    );
    return diversifyResults(
      allocated.map(({ dish, score, bucket }) => ({
        dishId: dish.id,
        score,
        matchPercent: Math.round(score * 100),
        explanation:
          bucket === "similar"
            ? buildExplanation(ctx.userVector, dish.tasteVector, dish.name)
            : bucketExplanation(bucket, dish),
        isSerendipitous: bucket === "new",
        bucket,
      })),
      dishesById,
    );
  }

  // Stage 4: Inject serendipity based on neophilia
  const reranked = stage4SerendipityReRanking(
    precisionRanked,
    ctx.neophiliaIndex,
    ctx.userVector,
    candidates,
  );

  return diversifyResults(reranked, dishesById);
}

// ─── Explicit Feedback Processing ─────────────────────────────────────────────

export type FeedbackType =
  | "rating_5_star"
  | "rating_4_star"
  | "rating_3_star"
  | "rating_2_star"
  | "rating_1_star"
  | "saved"
  | "unsaved"
  | "search_query"
  | "dish_result_click"
  | "dish_like"
  | "food_button_click"
  | "dismissed"
  | "hawker_tag_positive"
  | "hawker_tag_negative";

export interface ExplicitFeedbackEvent {
  type: FeedbackType;
  dishVector: TasteVector;
  /** Timestamp in ms since epoch. Used to apply recency decay. */
  timestamp?: number;
  /** Optional: hawker tags applied with this feedback */
  hawkerTags?: HawkerTasteTag[];
  /** The dish's tasteConfidence (0-1); 0 means its vector is a placeholder. */
  dishConfidence?: number;
}

const NEUTRAL_TASTE_VALUE = 5;

/** True when a vector is the all-5 neutral default (untagged dish, or a user with no taste signal). */
export function isNeutralTasteVector(vector: TasteVector | undefined | null): boolean {
  if (!vector) return true;
  return (Object.keys(vector) as (keyof TasteVector)[]).every(
    (key) => vector[key] === NEUTRAL_TASTE_VALUE,
  );
}

/** True when a dish carries a real taste signal: non-zero confidence and not the neutral default. */
export function hasDishTasteSignal(
  dish: Pick<DishSummary, "tasteVector" | "tasteConfidence">,
): boolean {
  return (dish.tasteConfidence ?? 1) > 0 && !isNeutralTasteVector(dish.tasteVector);
}

function applyFeedbackRecencyDecay(weight: number, timestamp?: number): number {
  if (timestamp === undefined) {
    return weight;
  }
  const ageDays = Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  return weight * Math.exp(-0.05 * ageDays);
}

/**
 * Feedback weight coefficients — how strongly each signal pulls/pushes the user vector.
 */
const FEEDBACK_WEIGHTS: Record<FeedbackType, number> = {
  rating_5_star: 0.15,
  rating_4_star: 0.08,
  rating_3_star: 0.0,
  rating_2_star: -0.05,
  rating_1_star: -0.15,
  saved: 0.1,
  unsaved: -0.03,
  search_query: 0.015,
  dish_result_click: 0.055,
  dish_like: 0.08,
  food_button_click: 0.055,
  dismissed: -0.08,
  hawker_tag_positive: 0.05,
  hawker_tag_negative: -0.05,
};

/**
 * Process an explicit feedback event and return an updated user taste vector.
 * Uses the existing `calibrateVector` with feedback-type-specific learning rates.
 */
export function processExplicitFeedback(
  currentVector: TasteVector,
  event: ExplicitFeedbackEvent,
): TasteVector {
  // An untagged dish carries the neutral default vector; learning from it would only drag
  // the user back toward neutral, so it gets no weight.
  if (
    !hasDishTasteSignal({ tasteVector: event.dishVector, tasteConfidence: event.dishConfidence })
  ) {
    return currentVector;
  }
  const alpha = applyFeedbackRecencyDecay(FEEDBACK_WEIGHTS[event.type], event.timestamp);
  if (alpha === 0) return currentVector;

  return calibrateVector(currentVector, event.dishVector, alpha);
}

// ─── Implicit Feedback Processing (Phase 2 Placeholder) ──────────────────────

export type ImplicitSignalType =
  | "category_click"
  | "dwell_time"
  | "photo_zoom"
  | "ignored_recommendation"
  | "rapid_scroll_past";

export interface ImplicitSignal {
  type: ImplicitSignalType;
  dishVector: TasteVector;
  /** Timestamp for recency decay */
  timestamp: number;
}

const IMPLICIT_WEIGHTS: Record<ImplicitSignalType, number> = {
  category_click: 0.05,
  dwell_time: 0.03,
  photo_zoom: 0.02,
  ignored_recommendation: -0.02,
  rapid_scroll_past: -0.01,
};

/**
 * Process a batch of implicit signals with recency decay.
 * Signals older than 30 days receive only 10% weight.
 */
export function processImplicitFeedback(
  currentVector: TasteVector,
  signals: ImplicitSignal[],
): TasteVector {
  let vector = { ...currentVector };
  const now = Date.now();

  for (const signal of signals) {
    const ageMs = now - signal.timestamp;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    // Recency decay: full weight within 7 days, 50% at 8–30 days, 10% beyond
    let decayFactor = 1.0;
    if (ageDays > 30) decayFactor = 0.1;
    else if (ageDays > 7) decayFactor = 0.5;

    const alpha = IMPLICIT_WEIGHTS[signal.type] * decayFactor;
    if (alpha === 0) continue;

    vector = calibrateVector(vector, signal.dishVector, alpha);
  }

  return vector;
}
