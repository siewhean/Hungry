import type { ONBOARDING_FOOD_IMAGES } from "./onboardingFoodImages";

export type CuisineImageKey = keyof typeof ONBOARDING_FOOD_IMAGES;

// First match wins, so the specific rule sits above the general one it would otherwise hit.
// "Asam laksa" has no photo of its own and must not borrow the coconut-curry laksa.
const RULES: readonly (readonly [RegExp, CuisineImageKey | null])[] = [
  [/asam\s+laksa/, null],
  [/chicken\s+rice/, "chickenRice"],
  [/laksa/, "laksa"],
  [/satay|sate\b/, "satay"],
  [/char\s+(kway|kuey)\s+teow/, "charKwayTeow"],
  [/kaya\s+toast/, "kayaToast"],
  [/pandan\s+(chiffon\s+)?cake/, "pandanCake"],
  [/kueh\s+tutu|kuih\s+tutu/, "kuehTutu"],
  [/fish\s+soup/, "fishSoup"],
  [/nasi\s+lemak/, "nasiLemak"],
  [/briyani|biryani/, "nasiBriyani"],
  [/mala\s+(xiang\s+guo|tang)|mala\b/, "mala"],
  [/japanese\s+curry|katsu\s+curry/, "japaneseCurry"],
  [/ramen/, "ramenSet"],
  [/jjigae|budae|korean\s+stew/, "budaeJjigae"],
  [/carrot\s+cake|chai\s+tow\s+kway/, "carrotCake"],
  [/mee\s+siam/, "meeSiam"],
];

/**
 * The quiz photo of the same kind of food, for a dish that has no photo of its own. It is an
 * example of the dish, never the stall's own plate, so the card labels it as one.
 */
export function cuisineImageKeyFor(dish: {
  name: string;
  foodTypeTag?: string;
}): CuisineImageKey | undefined {
  const text = `${dish.name} ${dish.foodTypeTag ?? ""}`.toLowerCase();
  for (const [pattern, key] of RULES) {
    if (pattern.test(text)) return key ?? undefined;
  }
  return undefined;
}
