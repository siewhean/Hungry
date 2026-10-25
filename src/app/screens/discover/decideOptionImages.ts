import type { ImageSourcePropType } from "react-native";

import { ONBOARDING_FOOD_IMAGES as FOOD } from "@/app/screens/onboarding/onboardingFoodImages";

/**
 * A food photo for each Decide for Me answer, from the bundled onboarding set. Each photo is used
 * once, so no two tiles look the same. Answers without a fitting photo (Western, "Decide for me")
 * show an icon tile instead, and price answers show a price tier (DECIDE_PRICE_TIERS), not food.
 */
export const DECIDE_OPTION_IMAGES: Readonly<Record<string, ImageSourcePropType>> = {
  local: FOOD.chickenRice,
  chinese: FOOD.charKwayTeow,
  malay: FOOD.satay,
  indian: FOOD.nasiBriyani,
  "japanese-korean": FOOD.ramenSet,
  rice: FOOD.nasiLemak,
  noodles: FOOD.laksa,
  soup: FOOD.fishSoup,
  snack: FOOD.kayaToast,
  dessert: FOOD.kuehTutu,
  spicy: FOOD.mala,
  sweet: FOOD.pandanCake,
  sour: FOOD.meeSiam,
  rich: FOOD.japaneseCurry,
};

/** The tile glyph for each price answer: a food photo would not match the price. */
export const DECIDE_PRICE_TIERS: Readonly<Record<string, string>> = {
  under5: "$",
  under8: "$$",
  under12: "$$$",
};
