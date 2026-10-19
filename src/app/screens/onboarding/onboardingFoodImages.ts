import type { ImageSourcePropType } from "react-native";

import type { TasteKey } from "@/types/domain";

export type OnboardingFoodImage = {
  label: string;
  imageSource: ImageSourcePropType;
};

export const ONBOARDING_FOOD_IMAGES = {
  chickenRice: require("../../../assets/onboarding/food/chicken-rice.png"),
  laksa: require("../../../assets/onboarding/food/laksa.png"),
  satay: require("../../../assets/onboarding/food/satay.png"),
  charKwayTeow: require("../../../assets/onboarding/food/char-kway-teow.png"),
  kayaToast: require("../../../assets/onboarding/food/kaya-toast.png"),
  pandanCake: require("../../../assets/onboarding/food/pandan-cake.png"),
  kuehTutu: require("../../../assets/onboarding/food/kueh-tutu.png"),
  fishSoup: require("../../../assets/onboarding/food/fish-soup.png"),
  yongTauFoo: require("../../../assets/onboarding/food/yong-tau-foo.png"),
  nasiLemak: require("../../../assets/onboarding/food/nasi-lemak.png"),
  rotiPrata: require("../../../assets/onboarding/food/roti-prata.png"),
  nasiBriyani: require("../../../assets/onboarding/food/nasi-briyani.png"),
  mala: require("../../../assets/onboarding/food/mala-xiang-guo.png"),
  japaneseCurry: require("../../../assets/onboarding/food/japanese-curry.png"),
  ramenSet: require("../../../assets/onboarding/food/ramen.png"),
  bibimbap: require("../../../assets/onboarding/food/bibimbap.png"),
  budaeJjigae: require("../../../assets/onboarding/food/korean-stew.png"),
  burger: require("../../../assets/onboarding/food/burger.png"),
  pasta: require("../../../assets/onboarding/food/pasta.png"),
  pizza: require("../../../assets/onboarding/food/pizza.png"),
} as const;

export const TASTE_QUESTION_FOODS: Record<TasteKey, readonly OnboardingFoodImage[]> = {
  sweet: [
    { label: "Kueh tutu", imageSource: ONBOARDING_FOOD_IMAGES.kuehTutu },
    { label: "Kaya toast", imageSource: ONBOARDING_FOOD_IMAGES.kayaToast },
    { label: "Pandan cake", imageSource: ONBOARDING_FOOD_IMAGES.pandanCake },
  ],
  spicy: [
    { label: "Laksa", imageSource: ONBOARDING_FOOD_IMAGES.laksa },
    { label: "Korean stew", imageSource: ONBOARDING_FOOD_IMAGES.budaeJjigae },
    { label: "Mala xiang guo", imageSource: ONBOARDING_FOOD_IMAGES.mala },
  ],
  sour: [
    { label: "Fish soup", imageSource: ONBOARDING_FOOD_IMAGES.fishSoup },
    { label: "Yong tau foo", imageSource: ONBOARDING_FOOD_IMAGES.yongTauFoo },
    { label: "Roti prata curry", imageSource: ONBOARDING_FOOD_IMAGES.rotiPrata },
  ],
  salty: [
    { label: "Fish soup", imageSource: ONBOARDING_FOOD_IMAGES.fishSoup },
    { label: "Chicken rice", imageSource: ONBOARDING_FOOD_IMAGES.chickenRice },
    { label: "Char kway teow", imageSource: ONBOARDING_FOOD_IMAGES.charKwayTeow },
  ],
  rich: [
    { label: "Ramen", imageSource: ONBOARDING_FOOD_IMAGES.ramenSet },
    { label: "Japanese curry", imageSource: ONBOARDING_FOOD_IMAGES.japaneseCurry },
    { label: "Laksa", imageSource: ONBOARDING_FOOD_IMAGES.laksa },
  ],
  aromatic: [
    { label: "Chicken rice", imageSource: ONBOARDING_FOOD_IMAGES.chickenRice },
    { label: "Nasi briyani", imageSource: ONBOARDING_FOOD_IMAGES.nasiBriyani },
    { label: "Satay", imageSource: ONBOARDING_FOOD_IMAGES.satay },
  ],
};
