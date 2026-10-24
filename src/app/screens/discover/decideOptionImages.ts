import type { ImageSourcePropType } from "react-native";

import { ONBOARDING_FOOD_IMAGES as FOOD } from "@/app/screens/onboarding/onboardingFoodImages";

/**
 * A food photo for each Decide for Me answer, from the bundled onboarding set. Answers without
 * a fitting photo (Western, "Decide for me") show an icon tile instead.
 */
export const DECIDE_OPTION_IMAGES: Readonly<Record<string, ImageSourcePropType>> = {
  local: FOOD.chickenRice,
  chinese: FOOD.charKwayTeow,
  malay: FOOD.nasiLemak,
  indian: FOOD.nasiBriyani,
  "japanese-korean": FOOD.ramenSet,
  rice: FOOD.chickenRice,
  noodles: FOOD.laksa,
  soup: FOOD.fishSoup,
  snack: FOOD.kayaToast,
  dessert: FOOD.kuehTutu,
  under5: FOOD.kayaToast,
  under8: FOOD.chickenRice,
  under12: FOOD.ramenSet,
  spicy: FOOD.mala,
  sweet: FOOD.pandanCake,
  sour: FOOD.meeSiam,
  rich: FOOD.japaneseCurry,
};
