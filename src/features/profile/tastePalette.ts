/**
 * The Taste Palette page: what Hungry has learned about a diner's taste and how it got there.
 * Rivals show this (Beli's taste profile, Vivino's "Match for You", Letterboxd's stats); Hungry
 * already learns from every save, like, review and "Not for me" but only drew a static radar.
 *
 * Built from what the phone already holds: the six taste levels, the taste interaction log
 * (each entry keeps the levels before and after it), and the food history (affinity per dish
 * and food type). Pure: no service reads, so the page renders at once and is tested here.
 */
import { stallTasteLean } from "@/features/discover/stallTaste";
import { TASTE_LABELS } from "@/lib/ai/tasteEngine";
import type {
  TasteInteractionEvent,
  TasteInteractionType,
  TasteKey,
  TasteVector,
  UserDishAffinity,
} from "@/types/domain";

export const PALETTE_AXES: readonly TasteKey[] = [
  "spicy",
  "rich",
  "salty",
  "sweet",
  "sour",
  "aromatic",
];

/** How far back "lately" looks. */
export const DRIFT_WINDOW_DAYS = 30;
/** A move smaller than this over the window is noise, not a trend. */
export const DRIFT_MIN_CHANGE = 0.5;
/** Signals before Hungry calls a palate "learning", then "confident". */
export const LEARNING_FROM_SIGNALS = 5;
export const CONFIDENT_FROM_SIGNALS = 20;

export type PaletteConfidence = "starting" | "learning" | "confident";

export type PaletteAxis = {
  key: TasteKey;
  label: string;
  /** 0-10. */
  level: number;
  /** A word for the level: what a diner would say. */
  word: "Love" | "Like" | "Easy either way" | "Go easy" | "Avoid";
};

export type PaletteShaper = {
  id: string;
  dishId?: string;
  type: TasteInteractionType;
  /** "Saved", "Liked", "Reviewed 5 stars", "Not for me". */
  action: string;
  createdAt: string;
  /** The taste this signal moved most, and by how much (signed). */
  moved?: { key: TasteKey; label: string; change: number };
};

export type PaletteFoodType = { foodType: string; label: string; score: number };

export type TastePalette = {
  axes: PaletteAxis[];
  /** Signals that changed the palate (quiz excluded). */
  signalCount: number;
  confidence: PaletteConfidence;
  /** The biggest move over the last 30 days, if any was big enough. */
  drift?: { key: TasteKey; label: string; change: number; sentence: string };
  /** Newest first, at most five. */
  shapedBy: PaletteShaper[];
  /** Food types the diner keeps coming back to, best first (at most five). */
  loves: PaletteFoodType[];
  /** Food types the diner turned down (at most three). */
  skips: PaletteFoodType[];
  /** Food types that suit the palate and the diner has not tried, best first (at most four). */
  tryNext: PaletteFoodType[];
};

/** Singapore food styles "Try next" can suggest; each is searched by its label. */
export const TRY_NEXT_STYLES: readonly string[] = [
  "Laksa",
  "Mee siam",
  "Nasi lemak",
  "Mee rebus",
  "Char kway teow",
  "Bak chor mee",
  "Mala xiang guo",
  "Tom yum",
  "Fish head curry",
  "Satay",
  "Prawn noodles",
  "Chicken rice",
  "Wanton mee",
  "Rojak",
  "Chendol",
  "Kaya toast",
  "Ramen",
  "Bibimbap",
  "Pho",
  "Biryani",
  "Roti prata",
  "Hokkien mee",
  "Carrot cake",
  "Duck rice",
];

export function levelWord(level: number): PaletteAxis["word"] {
  if (level >= 7.5) return "Love";
  if (level >= 6) return "Like";
  if (level > 4) return "Easy either way";
  if (level > 2.5) return "Go easy";
  return "Avoid";
}

const ACTION_WORDS: Partial<Record<TasteInteractionType, string>> = {
  saved: "Saved",
  unsaved: "Removed from saved",
  dish_like: "Liked",
  review: "Reviewed",
  rating: "Rated",
  dismissed: "Not for me",
  dish_result_click: "Opened",
  food_button_click: "Picked a food",
  hawker_tag: "Tagged a taste",
  search_query: "Searched",
};

function actionWord(event: TasteInteractionEvent): string {
  if ((event.type === "rating" || event.type === "review") && event.rating) {
    const stars = Math.round(event.rating);
    return `Rated ${stars} ${stars === 1 ? "star" : "stars"}`;
  }
  return ACTION_WORDS[event.type] ?? "Taste signal";
}

function biggestMove(before: TasteVector, after: TasteVector) {
  let best: { key: TasteKey; change: number } | undefined;
  for (const key of PALETTE_AXES) {
    const change = (after[key] ?? 5) - (before[key] ?? 5);
    if (!best || Math.abs(change) > Math.abs(best.change)) best = { key, change };
  }
  return best && Math.abs(best.change) >= 0.05 ? best : undefined;
}

const DRIFT_WORDS: Record<TasteKey, [up: string, down: string]> = {
  spicy: ["going spicier", "going milder on spice"],
  rich: ["going richer", "going lighter"],
  salty: ["going more savoury", "going less salty"],
  sweet: ["going sweeter", "going less sweet"],
  sour: ["going tangier", "going less sour"],
  aromatic: ["going more fragrant and herby", "going plainer on herbs"],
};

/** "Spicy" style label for a food type key ("char kway teow" -> "Char kway teow"). */
export function foodTypeLabel(foodType: string): string {
  const trimmed = foodType.trim().replace(/[_-]+/g, " ");
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed;
}

/** 0 to 1: how close a taste is to the palate, averaged over the six tastes. */
function fit(palate: TasteVector, taste: TasteVector): number {
  const gap = PALETTE_AXES.reduce((sum, key) => sum + Math.abs(palate[key] - taste[key]), 0) / 6;
  return Math.max(0, 1 - gap / 10);
}

export function buildTastePalette({
  vector,
  events,
  foodHistory,
  now = Date.now(),
}: {
  vector: TasteVector;
  events: readonly TasteInteractionEvent[];
  foodHistory: readonly UserDishAffinity[];
  now?: number;
}): TastePalette {
  const axes = PALETTE_AXES.map((key) => ({
    key,
    label: TASTE_LABELS[key],
    level: Math.round((vector[key] ?? 5) * 10) / 10,
    word: levelWord(vector[key] ?? 5),
  })).sort((left, right) => right.level - left.level);

  const applied = events
    .filter((event) => event.applied && event.type !== "quiz_completed")
    .slice()
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const signalCount = applied.length;
  const confidence: PaletteConfidence =
    signalCount >= CONFIDENT_FROM_SIGNALS
      ? "confident"
      : signalCount >= LEARNING_FROM_SIGNALS
        ? "learning"
        : "starting";

  // Drift: today's levels against the levels before the oldest signal inside the window.
  const windowStart = now - DRIFT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const inWindow = applied.filter((event) => Date.parse(event.createdAt) >= windowStart);
  let drift: TastePalette["drift"];
  if (inWindow.length > 0) {
    const oldest = inWindow[inWindow.length - 1];
    const move = biggestMove(oldest.userVectorBefore, vector);
    if (move && Math.abs(move.change) >= DRIFT_MIN_CHANGE) {
      const [up, down] = DRIFT_WORDS[move.key];
      drift = {
        key: move.key,
        label: TASTE_LABELS[move.key],
        change: Math.round(move.change * 10) / 10,
        sentence: `You have been ${move.change > 0 ? up : down} lately.`,
      };
    }
  }

  const shapedBy: PaletteShaper[] = applied
    .filter((event) => event.dishId)
    .slice(0, 5)
    .map((event) => {
      const move = biggestMove(event.userVectorBefore, event.userVectorAfter);
      return {
        id: event.id,
        dishId: event.dishId,
        type: event.type,
        action: actionWord(event),
        createdAt: event.createdAt,
        moved: move
          ? {
              key: move.key,
              label: TASTE_LABELS[move.key],
              change: Math.round(move.change * 10) / 10,
            }
          : undefined,
      };
    });

  // Food types: the signed evidence summed per type, shrunk by how much evidence there is.
  const byType = new Map<string, { evidence: number; abs: number }>();
  for (const row of foodHistory) {
    const foodType = row.foodType?.trim().toLowerCase();
    if (!foodType) continue;
    const entry = byType.get(foodType) ?? { evidence: 0, abs: 0 };
    entry.evidence += row.evidence;
    entry.abs += row.absEvidence;
    byType.set(foodType, entry);
  }
  const scored = [...byType.entries()].map(([foodType, entry]) => ({
    foodType,
    label: foodTypeLabel(foodType),
    score: Math.round((entry.evidence / (entry.abs + 2)) * 100) / 100,
  }));
  const loves = scored
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, 5);
  const skips = scored
    .filter((row) => row.score < 0)
    .sort((left, right) => left.score - right.score || left.label.localeCompare(right.label))
    .slice(0, 3);

  const tried = new Set(scored.map((row) => row.foodType));
  const tryNext = TRY_NEXT_STYLES.flatMap((style) => {
    const key = style.toLowerCase();
    if (tried.has(key)) return [];
    const lean = stallTasteLean(style);
    if (!lean) return [];
    // Never push heat at someone who avoids it.
    if (vector.spicy <= 3 && lean.spicy >= 6) return [];
    return [{ foodType: key, label: style, score: Math.round(fit(vector, lean) * 100) / 100 }];
  })
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, 4);

  return { axes, signalCount, confidence, drift, shapedBy, loves, skips, tryNext };
}

export const CONFIDENCE_WORDS: Record<PaletteConfidence, string> = {
  starting: "Just getting to know you",
  learning: "Learning fast",
  confident: "Knows your taste well",
};

/** "Learned from 14 dishes you saved, liked or reviewed." */
export function learnedFromSentence(signalCount: number): string {
  if (signalCount === 0) return "From your taste quiz. Save, like and review dishes to sharpen it.";
  return `Learned from ${signalCount} ${signalCount === 1 ? "thing" : "things"} you saved, liked, reviewed or turned down.`;
}

/** The taste as a noun, for sentences ("You both love spice"). */
export const TASTE_NOUNS: Record<TasteKey, string> = {
  spicy: "spice",
  rich: "richness",
  salty: "saltiness",
  sweet: "sweetness",
  sour: "sourness",
  aromatic: "fragrant herbs",
};

export type PalateComparisonRow = {
  key: TasteKey;
  label: string;
  mine: number;
  theirs: number;
  /** One short line: "You both love it", "They like it far stronger". */
  sentence: string;
};

/** Axis by axis, the viewer's palate against another diner's, biggest gap first. */
export function comparePalates(mine: TasteVector, theirs: TasteVector, theirName: string) {
  const rows: PalateComparisonRow[] = PALETTE_AXES.map((key) => {
    const a = mine[key] ?? 5;
    const b = theirs[key] ?? 5;
    const gap = b - a;
    const label = TASTE_LABELS[key];
    const noun = TASTE_NOUNS[key];
    let sentence: string;
    if (Math.abs(gap) < 1) {
      sentence =
        a >= 6.5
          ? `You both love ${noun}`
          : a <= 3.5
            ? `You both go easy on ${noun}`
            : `About the same on ${noun}`;
    } else {
      const strength = Math.abs(gap) >= 3 ? "far " : "";
      sentence =
        gap > 0 ? `${theirName} likes ${strength}more ${noun}` : `You like ${strength}more ${noun}`;
    }
    return { key, label, mine: Math.round(a * 10) / 10, theirs: Math.round(b * 10) / 10, sentence };
  });
  const shared = rows.filter((row) => Math.abs(row.mine - row.theirs) < 1);
  const different = rows
    .filter((row) => Math.abs(row.mine - row.theirs) >= 1)
    .sort((left, right) => Math.abs(right.theirs - right.mine) - Math.abs(left.theirs - left.mine));
  return { shared, different, rows: [...different, ...shared] };
}
