/**
 * Contextual Awareness Engine
 *
 * Provides time-of-day and environmental modifiers that gently nudge
 * the recommendation pipeline toward contextually appropriate dishes.
 *
 * Based on the Gastronomy Architecture research:
 * - Morning: lighter, carb-forward (porridge, toast, kopi)
 * - Lunch: balanced, slightly rich
 * - Afternoon: sweets, snacks, teh
 * - Dinner: heavy mains, claypot, rich dishes
 * - Late night: supper staples, mala, prata, spicy comfort
 *
 * Modifiers are small (±1 to ±2 per axis) — contextual nudges, not overrides.
 * The user's explicit taste vector always dominates.
 */

import type { TasteVector } from "@/types/domain";

// ─── Time-of-Day Segments ─────────────────────────────────────────────────────

export type TimeSegment =
  | "morning"
  | "lunch"
  | "afternoon"
  | "dinner"
  | "late_night";

/**
 * Determine the current time segment from an hour value (0–23).
 */
export function getTimeSegment(hour: number): TimeSegment {
  if (hour >= 6 && hour < 10) return "morning";
  if (hour >= 10 && hour < 14) return "lunch";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "dinner";
  return "late_night"; // 21–5
}

/**
 * Get the current time segment based on the device clock.
 */
export function getCurrentTimeSegment(): TimeSegment {
  return getTimeSegment(new Date().getHours());
}

// ─── Contextual Taste Modifiers ───────────────────────────────────────────────

/**
 * Time-of-day taste vector modifiers.
 * These are ADDED to the user's taste vector before scoring,
 * creating subtle temporal awareness in the recommendation feed.
 *
 * Values are bounded: max ±2 per axis to prevent dominating the user's
 * explicit preferences.
 */
const TIME_MODIFIERS: Record<TimeSegment, Partial<TasteVector>> = {
  morning: {
    sweet: 1,
    rich: -1,
    spicy: -1,
    aromatic: 1,
  },
  lunch: {
    salty: 1,
    rich: 1,
  },
  afternoon: {
    sweet: 2,
    sour: 1,
    rich: -1,
  },
  dinner: {
    rich: 2,
    salty: 1,
    aromatic: 1,
  },
  late_night: {
    spicy: 2,
    rich: 2,
    sweet: -1,
  },
};

// ─── Weather Modifiers (Future) ───────────────────────────────────────────────

export type WeatherCondition = "clear" | "rain" | "hot" | "cool";

const WEATHER_MODIFIERS: Record<WeatherCondition, Partial<TasteVector>> = {
  clear: {},
  rain: {
    rich: 2,
    aromatic: 1,
    sweet: -1,
  },
  hot: {
    sweet: 1,
    sour: 1,
    rich: -1,
  },
  cool: {
    rich: 1,
    spicy: 1,
  },
};

// ─── Context Modifier Application ─────────────────────────────────────────────

/**
 * Full context state for the recommendation pipeline.
 */
export interface ContextState {
  timeSegment: TimeSegment;
  weather?: WeatherCondition;
}

/**
 * Get the current context state from device sensors.
 * Weather is optional (requires future API integration).
 */
export function getCurrentContext(): ContextState {
  return {
    timeSegment: getCurrentTimeSegment(),
    // weather: undefined — future: integrate with weather API
  };
}

/**
 * Compute a combined context modifier from all active context signals.
 * Returns a Partial<TasteVector> that should be added to the user's vector.
 */
export function computeContextModifier(context: ContextState): Partial<TasteVector> {
  const timeMod = TIME_MODIFIERS[context.timeSegment];
  const weatherMod = context.weather ? WEATHER_MODIFIERS[context.weather] : {};

  // Merge modifiers (additive)
  const merged: Partial<TasteVector> = { ...timeMod };
  for (const [key, value] of Object.entries(weatherMod)) {
    const k = key as keyof TasteVector;
    merged[k] = (merged[k] ?? 0) + (value ?? 0);
  }

  return merged;
}

/**
 * Apply a context modifier to a taste vector.
 * Clamps each axis to [0, 10] after application.
 */
export function applyContextModifier(
  baseVector: TasteVector,
  modifier: Partial<TasteVector>
): TasteVector {
  return {
    sweet: clamp(baseVector.sweet + (modifier.sweet ?? 0), 0, 10),
    spicy: clamp(baseVector.spicy + (modifier.spicy ?? 0), 0, 10),
    sour: clamp(baseVector.sour + (modifier.sour ?? 0), 0, 10),
    salty: clamp(baseVector.salty + (modifier.salty ?? 0), 0, 10),
    rich: clamp(baseVector.rich + (modifier.rich ?? 0), 0, 10),
    aromatic: clamp(baseVector.aromatic + (modifier.aromatic ?? 0), 0, 10),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Display Helpers ──────────────────────────────────────────────────────────

const SEGMENT_LABELS: Record<TimeSegment, string> = {
  morning: "Good morning",
  lunch: "Lunchtime",
  afternoon: "Afternoon cravings",
  dinner: "Dinner time",
  late_night: "Late night munchies",
};

const SEGMENT_HINTS: Record<TimeSegment, string> = {
  morning: "Something light to start the day?",
  lunch: "Time for a proper meal",
  afternoon: "A sweet treat or snack?",
  dinner: "What's for supper?",
  late_night: "Supper o'clock — go shiok",
};

/**
 * Get a user-facing greeting for the current time segment.
 */
export function getTimeGreeting(segment: TimeSegment): string {
  return SEGMENT_LABELS[segment];
}

/**
 * Get a discovery hint for the current time segment.
 */
export function getTimeHint(segment: TimeSegment): string {
  return SEGMENT_HINTS[segment];
}
