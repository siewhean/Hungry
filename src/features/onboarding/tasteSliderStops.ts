import type { TasteKey } from "@/types/domain";

/** The five places a taste slider can rest. The thumb moves freely and settles on one on release. */
export const STOP_VALUES = [0, 2.5, 5, 7.5, 10] as const;
export const STOP_COUNT = STOP_VALUES.length;
export const MIN_SLIDER_VALUE = 0;
export const MAX_SLIDER_VALUE = 10;
/** The starting position and the value a skipped taste keeps: average. */
export const NEUTRAL_SLIDER_VALUE = 5;

/** The order the questions are asked in. Spice leads because it changes what people feel the most. */
export const TASTE_SLIDER_ORDER: readonly TasteKey[] = [
  "spicy",
  "sweet",
  "salty",
  "sour",
  "rich",
  "aromatic",
];

/** From this question on (the fourth) people may skip all the remaining tastes at once. */
export const SKIP_REST_FROM_INDEX = 3;

export type TasteStop = {
  /** Matches a file in src/assets/onboarding/sliders (see tasteSliderFoods.ts). */
  slug: string;
  dish: string;
  caption: string;
};

export type TasteSliderAxis = {
  question: string;
  /** Adjective for the live line: "A standard laksa is 6/10 spicy". */
  adjective: string;
  stops: readonly [TasteStop, TasteStop, TasteStop, TasteStop, TasteStop];
  /** The stop-5 dish and its score from the taste answer key, used for the live line. */
  reference: { dish: string; standard: number };
};

/**
 * One food per stop, picked from the taste answer key (data/taste-answer-key.xlsx): the dish whose
 * score on that axis is closest to the stop, no repeats, no pork, beef or alcohol.
 */
export const TASTE_SLIDER_AXES: Record<TasteKey, TasteSliderAxis> = {
  spicy: {
    question: "How spicy do you usually go?",
    adjective: "spicy",
    stops: [
      { slug: "fish-soup", dish: "Fish soup", caption: "Skip the chilli" },
      { slug: "spice-chicken-rice", dish: "Hainanese chicken rice", caption: "A little" },
      { slug: "laksa", dish: "Laksa", caption: "Medium" },
      { slug: "sambal-stingray", dish: "Sambal stingray", caption: "Hot" },
      { slug: "mala-xiang-guo", dish: "Mala xiang guo", caption: "Bring the fire" },
    ],
    reference: { dish: "laksa", standard: 6 },
  },
  sweet: {
    question: "How sweet do you like your food and drinks?",
    adjective: "sweet",
    stops: [
      { slug: "roti-prata-curry", dish: "Roti prata with curry", caption: "Not sweet" },
      { slug: "nasi-lemak", dish: "Nasi lemak", caption: "A touch" },
      { slug: "satay", dish: "Satay", caption: "Balanced" },
      { slug: "teh-tarik", dish: "Teh tarik", caption: "Sweet" },
      { slug: "ice-kacang", dish: "Ice kacang", caption: "Very sweet" },
    ],
    reference: { dish: "satay", standard: 5.5 },
  },
  salty: {
    question: "How salty do you like it?",
    adjective: "salty",
    stops: [
      { slug: "kaya-toast", dish: "Kaya toast with soft-boiled eggs", caption: "Light" },
      { slug: "popiah", dish: "Popiah", caption: "Mild" },
      { slug: "fishball-noodles", dish: "Fishball noodles", caption: "Balanced" },
      { slug: "duck-rice", dish: "Duck rice", caption: "Bold" },
      { slug: "har-cheong-gai", dish: "Prawn paste chicken", caption: "Heavy" },
    ],
    reference: { dish: "fishball noodles", standard: 6.5 },
  },
  sour: {
    question: "How much sourness do you enjoy?",
    adjective: "sour",
    stops: [
      { slug: "carrot-cake-black", dish: "Carrot cake", caption: "No tang" },
      { slug: "mee-rebus", dish: "Mee rebus", caption: "Subtle" },
      { slug: "rojak", dish: "Rojak", caption: "Balanced" },
      { slug: "mee-siam", dish: "Mee siam", caption: "Punchy" },
      { slug: "assam-pedas-fish", dish: "Assam pedas fish", caption: "Very sour" },
    ],
    reference: { dish: "rojak", standard: 5.5 },
  },
  rich: {
    question: "How rich do you like your food?",
    adjective: "rich",
    stops: [
      { slug: "yong-tau-foo", dish: "Yong tau foo soup", caption: "Light" },
      { slug: "bee-hoon", dish: "Economic bee hoon", caption: "Gentle" },
      { slug: "chilli-crab", dish: "Chilli crab", caption: "Balanced" },
      { slug: "goreng-pisang", dish: "Goreng pisang", caption: "Rich" },
      { slug: "oyster-omelette", dish: "Oyster omelette", caption: "Very rich" },
    ],
    reference: { dish: "chilli crab", standard: 6.5 },
  },
  aromatic: {
    question: "How fragrant do you like it?",
    adjective: "fragrant",
    stops: [
      { slug: "tau-huay", dish: "Tau huay", caption: "Subtle" },
      { slug: "orh-nee", dish: "Orh nee", caption: "Gentle" },
      { slug: "chendol", dish: "Chendol", caption: "Balanced" },
      { slug: "kopi", dish: "Kopi", caption: "Aromatic" },
      { slug: "chicken-biryani", dish: "Chicken biryani", caption: "Intense" },
    ],
    reference: { dish: "chendol", standard: 7 },
  },
};

export function clampSliderValue(value: number): number {
  if (!Number.isFinite(value)) return NEUTRAL_SLIDER_VALUE;
  return Math.max(MIN_SLIDER_VALUE, Math.min(MAX_SLIDER_VALUE, value));
}

/** The stop a value is closest to (0 to 4). A value halfway between two stops rounds up. */
export function nearestStopIndex(value: number): number {
  const index = Math.round(clampSliderValue(value) / 2.5);
  return Math.max(0, Math.min(STOP_COUNT - 1, index));
}

/** Where the thumb settles when the finger lifts. */
export function snapToStop(value: number): number {
  return STOP_VALUES[nearestStopIndex(value)]!;
}

/**
 * Old quiz answers were 2, 5 and 8. They move to the nearest new stop (2 to 2.5, 8 to 7.5), so a
 * saved profile is never lost and a retake starts where the person last was.
 */
export function stopForSavedAnswer(value: number): number {
  return snapToStop(value);
}

/** "7.5, Hot, Sambal stingray": what a screen reader says, and what shows under the food. */
export function describeStop(key: TasteKey, stopIndex: number): string {
  const index = Math.max(0, Math.min(STOP_COUNT - 1, stopIndex));
  const stop = TASTE_SLIDER_AXES[key].stops[index]!;
  return `${STOP_VALUES[index]}, ${stop.caption}, ${stop.dish}`;
}

/** "5" for a stop, "6.3" for a value in between: the number in the bubble above the thumb. */
export function formatSliderValue(value: number, settled: boolean): string {
  const clamped = clampSliderValue(value);
  if (settled) return Number.isInteger(clamped) ? String(clamped) : clamped.toFixed(1);
  return clamped.toFixed(1);
}
