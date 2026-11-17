import type { ImageSourcePropType } from "react-native";

import type { TasteKey } from "@/types/domain";

export type OnboardingFoodImage = {
  label: string;
  imageSource: ImageSourcePropType;
};

export type OnboardingCuisineCard = OnboardingFoodImage & {
  id: string;
};

export type OnboardingFoodChoice = OnboardingFoodImage & {
  id: string;
  venueName: string;
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

export const ONBOARDING_CUISINES: OnboardingCuisineCard[] = [
  { id: "local", label: "Local", imageSource: ONBOARDING_FOOD_IMAGES.chickenRice },
  { id: "japanese", label: "Japanese", imageSource: ONBOARDING_FOOD_IMAGES.japaneseCurry },
  { id: "western", label: "Western", imageSource: ONBOARDING_FOOD_IMAGES.burger },
  { id: "korean", label: "Korean", imageSource: ONBOARDING_FOOD_IMAGES.bibimbap },
  { id: "chinese", label: "Chinese", imageSource: ONBOARDING_FOOD_IMAGES.charKwayTeow },
  { id: "muslim", label: "Muslim-friendly", imageSource: ONBOARDING_FOOD_IMAGES.nasiLemak },
  { id: "indian", label: "Indian", imageSource: ONBOARDING_FOOD_IMAGES.rotiPrata },
  { id: "malay", label: "Malay", imageSource: ONBOARDING_FOOD_IMAGES.satay },
  { id: "italian", label: "Italian", imageSource: ONBOARDING_FOOD_IMAGES.pasta },
];

export const ONBOARDING_CUISINE_LABELS = ONBOARDING_CUISINES.reduce(
  (labels, cuisine) => ({
    ...labels,
    [cuisine.id]: cuisine.label,
  }),
  {} as Record<string, string>,
);

export const ONBOARDING_CUISINE_FOOD_CHOICES: Record<string, OnboardingFoodChoice[]> = {
  local: [
    {
      id: "dish-chicken-rice",
      label: "Chicken Rice",
      imageSource: ONBOARDING_FOOD_IMAGES.chickenRice,
      venueName: "Maxwell Food Centre",
    },
    {
      id: "dish-laksa",
      label: "Laksa",
      imageSource: ONBOARDING_FOOD_IMAGES.laksa,
      venueName: "Katong-style laksa",
    },
    {
      id: "dish-satay",
      label: "Satay",
      imageSource: ONBOARDING_FOOD_IMAGES.satay,
      venueName: "Lau Pa Sat",
    },
    {
      id: "dish-kaya-toast",
      label: "Kaya Toast",
      imageSource: ONBOARDING_FOOD_IMAGES.kayaToast,
      venueName: "Kopitiam breakfast",
    },
  ],
  japanese: [
    {
      id: "dish-japanese-curry",
      label: "Japanese Curry",
      imageSource: ONBOARDING_FOOD_IMAGES.japaneseCurry,
      venueName: "Curry rice",
    },
    {
      id: "onboarding-ramen-set",
      label: "Ramen",
      imageSource: ONBOARDING_FOOD_IMAGES.ramenSet,
      venueName: "Japanese noodles",
    },
  ],
  western: [
    {
      id: "dish-wagyu-burger",
      label: "Burger",
      imageSource: ONBOARDING_FOOD_IMAGES.burger,
      venueName: "Western grill",
    },
    {
      id: "dish-truffle-tagliatelle",
      label: "Pasta",
      imageSource: ONBOARDING_FOOD_IMAGES.pasta,
      venueName: "Pasta counter",
    },
    {
      id: "dish-burrata-pizza",
      label: "Pizza",
      imageSource: ONBOARDING_FOOD_IMAGES.pizza,
      venueName: "Pizza bar",
    },
  ],
  korean: [
    {
      id: "onboarding-bibimbap",
      label: "Bibimbap",
      imageSource: ONBOARDING_FOOD_IMAGES.bibimbap,
      venueName: "Korean rice bowl",
    },
    {
      id: "onboarding-korean-stew",
      label: "Korean Stew",
      imageSource: ONBOARDING_FOOD_IMAGES.budaeJjigae,
      venueName: "Korean hotpot",
    },
  ],
  chinese: [
    {
      id: "onboarding-char-kway-teow",
      label: "Char Kway Teow",
      imageSource: ONBOARDING_FOOD_IMAGES.charKwayTeow,
      venueName: "Wok-fried noodles",
    },
    {
      id: "dish-ban-mian",
      label: "Ban Mian",
      imageSource: ONBOARDING_FOOD_IMAGES.fishSoup,
      venueName: "Noodle stall",
    },
    {
      id: "onboarding-yong-tau-foo",
      label: "Yong Tau Foo",
      imageSource: ONBOARDING_FOOD_IMAGES.yongTauFoo,
      venueName: "Hawker soup stall",
    },
  ],
  muslim: [
    {
      id: "onboarding-nasi-lemak",
      label: "Nasi Lemak",
      imageSource: ONBOARDING_FOOD_IMAGES.nasiLemak,
      venueName: "Muslim-friendly rice plate",
    },
    {
      id: "dish-satay",
      label: "Chicken Satay",
      imageSource: ONBOARDING_FOOD_IMAGES.satay,
      venueName: "Halal-friendly grill",
    },
    {
      id: "onboarding-nasi-briyani",
      label: "Nasi Briyani",
      imageSource: ONBOARDING_FOOD_IMAGES.nasiBriyani,
      venueName: "Biryani stall",
    },
  ],
  indian: [
    {
      id: "onboarding-roti-prata",
      label: "Roti Prata",
      imageSource: ONBOARDING_FOOD_IMAGES.rotiPrata,
      venueName: "Indian Muslim stall",
    },
    {
      id: "onboarding-nasi-briyani",
      label: "Nasi Briyani",
      imageSource: ONBOARDING_FOOD_IMAGES.nasiBriyani,
      venueName: "Biryani stall",
    },
  ],
  malay: [
    {
      id: "onboarding-nasi-lemak",
      label: "Nasi Lemak",
      imageSource: ONBOARDING_FOOD_IMAGES.nasiLemak,
      venueName: "Malay rice plate",
    },
    {
      id: "dish-satay",
      label: "Satay",
      imageSource: ONBOARDING_FOOD_IMAGES.satay,
      venueName: "Skewer stall",
    },
    {
      id: "dish-laksa",
      label: "Laksa",
      imageSource: ONBOARDING_FOOD_IMAGES.laksa,
      venueName: "Coconut curry noodles",
    },
  ],
  italian: [
    {
      id: "dish-truffle-tagliatelle",
      label: "Pasta",
      imageSource: ONBOARDING_FOOD_IMAGES.pasta,
      venueName: "Pasta counter",
    },
    {
      id: "dish-burrata-pizza",
      label: "Pizza",
      imageSource: ONBOARDING_FOOD_IMAGES.pizza,
      venueName: "Pizza bar",
    },
  ],
};

export const ONBOARDING_RESULT_DISH_IMAGES: Record<string, ImageSourcePropType> = {
  "dish-chicken-rice": ONBOARDING_FOOD_IMAGES.chickenRice,
  "dish-ban-mian": ONBOARDING_FOOD_IMAGES.fishSoup,
  "dish-satay": ONBOARDING_FOOD_IMAGES.satay,
  "dish-japanese-curry": ONBOARDING_FOOD_IMAGES.japaneseCurry,
  "dish-laksa": ONBOARDING_FOOD_IMAGES.laksa,
  "dish-fish-soup": ONBOARDING_FOOD_IMAGES.fishSoup,
  "dish-kaya-toast": ONBOARDING_FOOD_IMAGES.kayaToast,
  "dish-salmon-don": ONBOARDING_FOOD_IMAGES.ramenSet,
  "dish-pandan-cake": ONBOARDING_FOOD_IMAGES.pandanCake,
  "dish-wagyu-burger": ONBOARDING_FOOD_IMAGES.burger,
  "dish-sushi-set": ONBOARDING_FOOD_IMAGES.ramenSet,
  "dish-mala-xiang-guo": ONBOARDING_FOOD_IMAGES.mala,
  "dish-truffle-tagliatelle": ONBOARDING_FOOD_IMAGES.pasta,
  "dish-burrata-pizza": ONBOARDING_FOOD_IMAGES.pizza,
};

export function getOnboardingDishImageSource(dishId: string): ImageSourcePropType {
  return ONBOARDING_RESULT_DISH_IMAGES[dishId] ?? ONBOARDING_FOOD_IMAGES.chickenRice;
}

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
