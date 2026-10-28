import { NEUTRAL_TASTE_VECTOR, TASTE_DIMENSIONS } from "@/constants/taste";
import type { TasteKey, TasteVector } from "@/types/domain";
import { perceivedTasteLevel } from "@/features/detail/perceivedTaste";
import { TASTE_SLIDER_AXES } from "./tasteSliderStops";

/**
 * What the intro screen says about the same laksa tasting different to two people. Laksa is 6/10
 * spicy for everyone; the two diners are fixed examples, not the person.
 */
export const LAKSA_STANDARD = 6;
export const SENSITIVE_DINER = { name: "Mei", level: 2.5 } as const;
export const TOLERANT_DINER = { name: "Raj", level: 7.5 } as const;

export function laksaFeltBy(level: number): number {
  return perceivedTasteLevel(LAKSA_STANDARD, level);
}

/** Low scores mean sensitive, high mean tolerant: the words that go with a score. */
const LEANING_WORDS: Record<TasteKey, { high: string; low: string }> = {
  spicy: { high: "spice lover", low: "spice shy" },
  sweet: { high: "sweet tooth", low: "light on sweet" },
  salty: { high: "bold on salt", low: "light on salt" },
  sour: { high: "tang fan", low: "easy on sour" },
  rich: { high: "rich food fan", low: "keeps it light" },
  aromatic: { high: "rempah lover", low: "plain and clean" },
};

export type PalateSummary = {
  /** "Sweet tooth, spice shy", or null when nothing was answered. */
  headline: string | null;
  /** Tastes the person answered, strongest lean first. */
  answered: readonly TasteKey[];
  /** Tastes left as "not set". */
  notSet: readonly TasteKey[];
};

/** Up to two strongest leanings (away from 5), only for tastes the person answered. */
export function summarisePalate(
  vector: TasteVector,
  answeredKeys: readonly TasteKey[],
): PalateSummary {
  const answered = TASTE_DIMENSIONS.map((d) => d.key).filter((key) => answeredKeys.includes(key));
  const notSet = TASTE_DIMENSIONS.map((d) => d.key).filter((key) => !answeredKeys.includes(key));
  const leanings = answered
    .map((key) => ({ key, lean: vector[key] - NEUTRAL_TASTE_VECTOR[key] }))
    .filter(({ lean }) => lean !== 0)
    .sort((a, b) => Math.abs(b.lean) - Math.abs(a.lean))
    .slice(0, 2)
    .map(({ key, lean }) => LEANING_WORDS[key][lean > 0 ? "high" : "low"]);
  const headline =
    leanings.length > 0
      ? `${leanings.join(", ")}`.replace(/^./, (letter) => letter.toUpperCase())
      : answered.length > 0
        ? "Balanced across the board"
        : null;
  return { headline, answered, notSet };
}

/**
 * One example in the person's own numbers: "A standard laksa will taste 8.4/10 spicy to you."
 * Uses the strongest answered taste; null when nothing was answered.
 */
export function palateExample(
  vector: TasteVector,
  answeredKeys: readonly TasteKey[],
): string | null {
  const strongest = answeredKeys
    .map((key) => ({ key, lean: Math.abs(vector[key] - NEUTRAL_TASTE_VECTOR[key]) }))
    .sort((a, b) => b.lean - a.lean)[0];
  const key = strongest?.key ?? answeredKeys[0];
  if (!key) return null;
  const axis = TASTE_SLIDER_AXES[key];
  const felt = perceivedTasteLevel(axis.reference.standard, vector[key]);
  return `A standard ${axis.reference.dish} will taste ${felt}/10 ${axis.adjective} to you.`;
}
