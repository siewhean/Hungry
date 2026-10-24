/**
 * Mall mode on Discover: when the diner is inside a mall or food centre the page offers
 * "For you" (dishes ranked by their own palate) and "What's here" (every stall, filterable).
 * Pure: the screen passes the dishes and stalls it already holds.
 */
import { rankDecideCandidates } from "@/features/discovery/decideForMeCandidates";
import { hasPersonalTasteProfile, tasteMatchPercent } from "@/lib/ai/tasteEngine";
import type { DietaryFlag, DishDetail, TasteVector, VenueSummary } from "@/types/domain";

const AXIS_NAMES: { key: keyof TasteVector; label: string }[] = [
  { key: "spicy", label: "spicy" },
  { key: "sweet", label: "sweet" },
  { key: "sour", label: "sour" },
  { key: "salty", label: "salty" },
  { key: "rich", label: "rich" },
  { key: "aromatic", label: "aromatic" },
];

/** A dish counts as strong (or mild) on an axis at these levels, matching the profile summary. */
const STRONG_LEVEL = 6;
const MILD_LEVEL = 3;
const FOR_YOU_LIMIT = 12;
/** Wide enough that the distance gate in the ranking never removes a dish. */
const NO_RADIUS_LIMIT_METERS = 1_000_000;

export type ForYouPick = {
  dish: DishDetail;
  /** 0-100, or undefined when the diner has no palate set up yet. */
  matchPercent?: number;
  reason: string;
};

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** One line on why the dish suits this palate. */
export function forYouReason(dish: DishDetail, userVector: TasteVector): string {
  if (!hasPersonalTasteProfile(userVector)) return "Popular here";
  const sharedStrong = AXIS_NAMES.filter(
    ({ key }) => dish.tasteVector[key] >= STRONG_LEVEL && userVector[key] >= STRONG_LEVEL,
  ).map(({ label }) => label);
  if (sharedStrong.length)
    return `${capitalise(joinWords(sharedStrong.slice(0, 2)))}, the way you like it`;
  const sharedMild = AXIS_NAMES.filter(
    ({ key }) => dish.tasteVector[key] <= MILD_LEVEL && userVector[key] <= MILD_LEVEL,
  ).map(({ label }) => label);
  if (sharedMild.length) return `Mild on ${joinWords(sharedMild.slice(0, 2))}, as you prefer`;
  return "Close to your palate";
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Dishes in taste order for this diner. Dietary needs are a hard filter (the ranking drops
 * unsafe dishes); a dish from `preferBuildingId` wins ties so the mall's own food leads.
 */
export function rankForYou(
  dishes: DishDetail[],
  options: {
    tasteVector: TasteVector;
    dietaryFlags: DietaryFlag[];
    maxDishBudget?: number;
    preferBuildingId?: string;
    limit?: number;
  },
): ForYouPick[] {
  const hasPalate = hasPersonalTasteProfile(options.tasteVector);
  const ranked = rankDecideCandidates(dishes, {
    tasteVector: options.tasteVector,
    dietaryFlags: options.dietaryFlags,
    radiusMeters: NO_RADIUS_LIMIT_METERS,
    maxDishBudget: options.maxDishBudget,
  });
  // Stable partition keeps the taste order inside each group.
  const here = options.preferBuildingId
    ? ranked.filter((dish) => dish.buildingId === options.preferBuildingId)
    : [];
  const elsewhere = options.preferBuildingId
    ? ranked.filter((dish) => dish.buildingId !== options.preferBuildingId)
    : ranked;
  return [...here, ...elsewhere].slice(0, options.limit ?? FOR_YOU_LIMIT).map((dish) => ({
    dish,
    matchPercent: hasPalate ? tasteMatchPercent(options.tasteVector, dish.tasteVector) : undefined,
    reason: forYouReason(dish, options.tasteVector),
  }));
}

export type HereStall = {
  venue: VenueSummary;
  dishes: DishDetail[];
  topDish?: DishDetail;
};

export type PriceBandId = "under5" | "5to8" | "8plus";

export const PRICE_BANDS: readonly { id: PriceBandId; label: string; min: number; max: number }[] =
  [
    { id: "under5", label: "Under S$5", min: 0, max: 5 },
    { id: "5to8", label: "S$5 to 8", min: 5, max: 8 },
    { id: "8plus", label: "S$8+", min: 8, max: Number.POSITIVE_INFINITY },
  ];

export type HereFilters = { cuisine?: string; priceBand?: PriceBandId };

/** A stall's food types, lower-cased, from its dishes' food type tag. */
export function stallCuisines(stall: HereStall): string[] {
  const tags = stall.dishes
    .map((dish) => dish.foodTypeTag?.trim().toLowerCase())
    .filter((tag): tag is string => Boolean(tag));
  return [...new Set(tags)];
}

/** The most common food types among these stalls, so the filter only offers what exists. */
export function cuisineOptions(stalls: HereStall[], limit = 6): string[] {
  const counts = new Map<string, number>();
  for (const stall of stalls) {
    for (const tag of stallCuisines(stall)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

function inBand(price: number, band: PriceBandId): boolean {
  const range = PRICE_BANDS.find((item) => item.id === band);
  if (!range) return true;
  // The edges belong to the cheaper band: S$5 is "Under S$5", S$8 is "S$5 to 8".
  return band === "under5"
    ? price > 0 && price <= range.max
    : price > range.min && price <= range.max;
}

export function filterHereStalls(stalls: HereStall[], filters: HereFilters): HereStall[] {
  return stalls.filter((stall) => {
    if (filters.cuisine && !stallCuisines(stall).includes(filters.cuisine)) return false;
    const band = filters.priceBand;
    if (band && !stall.dishes.some((dish) => inBand(dish.price, band))) return false;
    return true;
  });
}

/** "S$4.50" or "S$4.50 to 9.00"; empty when no dish has a price. */
export function stallPriceLabel(stall: HereStall): string {
  const prices = stall.dishes.map((dish) => dish.price).filter((price) => price > 0);
  if (!prices.length) return "";
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high ? `S$${low.toFixed(2)}` : `S$${low.toFixed(2)} to ${high.toFixed(2)}`;
}
