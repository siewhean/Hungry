import type { ImageSourcePropType } from "react-native";

import type { TasteKey } from "@/types/domain";

export type OnboardingFoodImage = {
  label: string;
  /** Omitted until a generated photo exists; the quiz then shows the shared no-photo tile. */
  imageSource?: ImageSourcePropType;
};

// Only photos a question shows are required (and so bundled). Source files are 600 px WebP.
export const ONBOARDING_FOOD_IMAGES = {
  chickenRice: require("../../../assets/onboarding/food/chicken-rice.webp"),
  laksa: require("../../../assets/onboarding/food/laksa.webp"),
  satay: require("../../../assets/onboarding/food/satay.webp"),
  charKwayTeow: require("../../../assets/onboarding/food/char-kway-teow.webp"),
  kayaToast: require("../../../assets/onboarding/food/kaya-toast.webp"),
  pandanCake: require("../../../assets/onboarding/food/pandan-cake.webp"),
  kuehTutu: require("../../../assets/onboarding/food/kueh-tutu.webp"),
  fishSoup: require("../../../assets/onboarding/food/fish-soup.webp"),
  nasiLemak: require("../../../assets/onboarding/food/nasi-lemak.webp"),
  nasiBriyani: require("../../../assets/onboarding/food/nasi-briyani.webp"),
  mala: require("../../../assets/onboarding/food/mala-xiang-guo.webp"),
  japaneseCurry: require("../../../assets/onboarding/food/japanese-curry.webp"),
  ramenSet: require("../../../assets/onboarding/food/ramen.webp"),
  budaeJjigae: require("../../../assets/onboarding/food/korean-stew.webp"),
  carrotCake: require("../../../assets/onboarding/food/carrot-cake.webp"),
  meeSiam: require("../../../assets/onboarding/food/mee-siam.webp"),
} as const;

// Each question lists its three dishes from the lightest answer to the strongest, so the
// example under a label matches the label.
export const TASTE_QUESTION_FOODS: Record<TasteKey, readonly OnboardingFoodImage[]> = {
  sweet: [
    { label: "Kueh tutu", imageSource: ONBOARDING_FOOD_IMAGES.kuehTutu },
    { label: "Kaya toast", imageSource: ONBOARDING_FOOD_IMAGES.kayaToast },
    { label: "Pandan cake", imageSource: ONBOARDING_FOOD_IMAGES.pandanCake },
  ],
  spicy: [
    { label: "Korean stew", imageSource: ONBOARDING_FOOD_IMAGES.budaeJjigae },
    { label: "Laksa", imageSource: ONBOARDING_FOOD_IMAGES.laksa },
    { label: "Mala xiang guo", imageSource: ONBOARDING_FOOD_IMAGES.mala },
  ],
  sour: [
    { label: "Mee siam", imageSource: ONBOARDING_FOOD_IMAGES.meeSiam },
    { label: "Rojak" },
    { label: "Asam laksa" },
  ],
  salty: [
    { label: "Fish soup", imageSource: ONBOARDING_FOOD_IMAGES.fishSoup },
    { label: "Chai tow kway", imageSource: ONBOARDING_FOOD_IMAGES.carrotCake },
    { label: "Char kway teow", imageSource: ONBOARDING_FOOD_IMAGES.charKwayTeow },
  ],
  rich: [
    { label: "Ramen", imageSource: ONBOARDING_FOOD_IMAGES.ramenSet },
    { label: "Japanese curry", imageSource: ONBOARDING_FOOD_IMAGES.japaneseCurry },
    { label: "Nasi lemak", imageSource: ONBOARDING_FOOD_IMAGES.nasiLemak },
  ],
  aromatic: [
    { label: "Chicken rice", imageSource: ONBOARDING_FOOD_IMAGES.chickenRice },
    { label: "Nasi briyani", imageSource: ONBOARDING_FOOD_IMAGES.nasiBriyani },
    { label: "Satay", imageSource: ONBOARDING_FOOD_IMAGES.satay },
  ],
};
