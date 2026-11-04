// Which Passport stamp categories a visited stall counts toward, from what the catalog knows
// about it: its cuisine tags, the kind of building it is in, and where that is. Pure.

import type { PassportCategory, StallStampFacts } from "@/types/domain";

/** Cuisine tags (exact) that count as each cuisine category. */
const CUISINE_TAGS: Record<string, readonly string[]> = {
  chinese: [
    "chinese",
    "halal chinese",
    "cantonese",
    "hongkong",
    "fujian",
    "hainanese",
    "dim_sum",
    "dim sum",
    "tze-char",
    "hotpot",
    "hot_pot",
    "mala",
    "caifang",
  ],
  malay: ["malay", "malaysian", "nasi_lemak", "nasi_lema", "muslim", "muslim_food", "indonesian"],
  indian: ["indian", "sri_lankan", "nepalese"],
  japanese: ["japanese", "sushi", "ramen", "yakitori", "teppanyaki", "beef_bowl"],
  western: [
    "western",
    "european",
    "american",
    "italian",
    "italian_pizza",
    "pizza",
    "pasta",
    "burger",
    "steak",
    "steak_house",
    "french",
    "german",
    "diner",
    "fish_and_chips",
    "mediterranean",
  ],
};

/** Planning areas (lower case) that count as each area category. */
const PLANNING_AREAS: Record<string, readonly string[]> = {
  cbd: ["marina bay", "downtown core", "raffles place"],
  chinatown: ["chinatown"],
  tampines: ["tampines"],
};

/** Neighbourhoods that are not a planning area in the catalog: found in the building name or address. */
const PLACE_WORDS: Record<string, string> = {
  bugis: "bugis",
  tiong_bahru: "tiong bahru",
};

export function stallMatchesCategory(
  facts: StallStampFacts,
  category: Pick<PassportCategory, "matchTag">,
): boolean {
  const tag = category.matchTag.toLowerCase();
  if (tag === "hawker") return facts.buildingType === "hawker_centre";
  const cuisines = CUISINE_TAGS[tag];
  if (cuisines) return facts.cuisineTags.some((item) => cuisines.includes(item));
  const areas = PLANNING_AREAS[tag];
  if (areas) return areas.includes((facts.planningArea ?? "").toLowerCase());
  const word = PLACE_WORDS[tag];
  if (word) return (facts.placeText ?? "").toLowerCase().includes(word);
  return false;
}
