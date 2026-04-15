/**
 * Dietary Hard-Filter Logic Gate
 *
 * Implements a deterministic, safety-critical pre-filter that guarantees
 * biologically, ethically, and religiously unsafe dishes are NEVER scored
 * or recommended by the AI engine.
 *
 * Architecture: Bitmask-based exclusion filter.
 * - Each DietaryFlag maps to a unique bit position
 * - User restrictions encode as an exclusion bitmask
 * - Dish flags encode as a content bitmask
 * - Bitwise AND detects conflicts in O(1) per dish
 *
 * SAFETY RULE: This gate runs BEFORE any AI scoring.
 * The AI engine never sees unsafe dishes.
 */

import type { DietaryFlag, DishSummary } from "@/types/domain";

// ─── Bitmask Registry ─────────────────────────────────────────────────────────

/**
 * Maps each DietaryFlag to a unique bit position.
 * Uses bigint-safe bit positions to support 30+ flags.
 *
 * Production note: this maps directly to a `bigint` column in Supabase
 * with a B-tree index for WHERE (dish.mask & user.mask) = 0 queries.
 */
const FLAG_BIT_MAP: Record<DietaryFlag, number> = {
  halal: 0,
  vegetarian: 1,
  vegan: 2,
  pork_free: 3,
  nut_free: 4,
  gluten_free: 5,
  dairy_free: 6,
  egg_free: 7,
  peanut_free: 8,
  shellfish_free: 9,
  soy_free: 10,
  sesame_free: 11,
  pescatarian: 12,
  kosher: 13,
  keto: 14,
  paleo: 15,
  low_carb: 16,
  low_sodium: 17,
  low_sugar: 18,
  diabetic_friendly: 19,
  fodmap_friendly: 20,
  beef_free: 21,
  allium_free: 22,
  fish_free: 23,
  mollusc_free: 24,
  celery_free: 25,
  mustard_free: 26,
  lupin_free: 27,
  sulphite_free: 28,
};

/** Numeric bitmask encoding of dietary flags */
export type DietaryMask = number;

// ─── Encoding ─────────────────────────────────────────────────────────────────

/**
 * Encode an array of DietaryFlag values into a numeric bitmask.
 * Each flag sets its corresponding bit to 1.
 */
export function encodeDietaryFlags(flags: DietaryFlag[]): DietaryMask {
  let mask = 0;
  for (const flag of flags) {
    const bit = FLAG_BIT_MAP[flag];
    if (bit !== undefined) {
      mask |= 1 << bit;
    }
  }
  return mask;
}

// ─── Conflict Detection ───────────────────────────────────────────────────────

/**
 * Check if a dish conflicts with the user's dietary restrictions.
 *
 * Logic: the user's restriction flags represent what they CANNOT eat.
 * A dish's dietary flags represent what it IS (e.g., "halal" means it IS halal).
 *
 * For exclusion flags (e.g., "pork_free"), a conflict means:
 * - User requires "pork_free" (bit set in user mask)
 * - Dish does NOT have "pork_free" (bit NOT set in dish mask)
 *
 * Returns true if there IS a conflict (dish is UNSAFE for this user).
 */
export function hasConflict(
  userRequirements: DietaryMask,
  dishFlags: DietaryMask
): boolean {
  // If the user requires certain flags and the dish doesn't have them,
  // the AND of userRequirements with the COMPLEMENT of dishFlags will be non-zero
  return (userRequirements & ~dishFlags) !== 0;
}

/**
 * Check if a specific dish is safe for a user, given their dietary preferences.
 * Convenience wrapper over bitmask operations.
 */
export function isDishSafe(
  dish: DishSummary,
  userFlags: DietaryFlag[]
): boolean {
  if (userFlags.length === 0) return true; // no restrictions = everything is safe

  const userMask = encodeDietaryFlags(userFlags);
  const dishMask = encodeDietaryFlags(dish.dietaryFlags);
  return !hasConflict(userMask, dishMask);
}

// ─── Batch Filtering ──────────────────────────────────────────────────────────

/**
 * Filter a list of dishes to only those safe for the user.
 * This is the primary entry point for Stage 1 of the recommendation pipeline.
 *
 * SAFETY CONTRACT:
 * - Zero false positives (no unsafe dish ever passes)
 * - This function runs BEFORE any AI scoring
 * - The returned array is the only candidate pool the AI engine sees
 */
export function filterSafeDishes<T extends DishSummary>(
  dishes: T[],
  userFlags: DietaryFlag[]
): T[] {
  if (userFlags.length === 0) return dishes;

  const userMask = encodeDietaryFlags(userFlags);
  return dishes.filter((dish) => {
    const dishMask = encodeDietaryFlags(dish.dietaryFlags);
    return !hasConflict(userMask, dishMask);
  });
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Get a human-readable list of which restrictions a dish violates.
 * Useful for UI messaging ("This dish is not pork-free").
 */
export function getViolatedRestrictions(
  dish: DishSummary,
  userFlags: DietaryFlag[]
): DietaryFlag[] {
  return userFlags.filter((flag) => !dish.dietaryFlags.includes(flag));
}

/**
 * Get all available dietary flags with their bit positions.
 * Useful for debug views and data validation.
 */
export function getAllFlagBits(): Array<{ flag: DietaryFlag; bit: number }> {
  return Object.entries(FLAG_BIT_MAP).map(([flag, bit]) => ({
    flag: flag as DietaryFlag,
    bit,
  }));
}
