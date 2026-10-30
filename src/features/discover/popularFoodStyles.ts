export const POPULAR_LAKSA_GRAPHIC = require("../../assets/discover/popular-laksa-topdown.png");
export const POPULAR_CHICKEN_RICE_GRAPHIC = require("../../assets/discover/popular-chicken-rice-topdown.png");
export const POPULAR_CHAR_KWAY_TEOW_GRAPHIC = require("../../assets/discover/popular-char-kway-teow-topdown.png");
export const POPULAR_BAK_CHOR_MEE_GRAPHIC = require("../../assets/discover/popular-bak-chor-mee-topdown.png");

export type PopularFoodStyle = {
  id: string;
  label: string;
  query: string;
  dishId?: string;
  imageSource?: number;
};

export const POPULAR_FOOD_STYLES: readonly PopularFoodStyle[] = [
  {
    id: "laksa",
    label: "Laksa",
    query: "Laksa",
    dishId: "dish-laksa",
    imageSource: POPULAR_LAKSA_GRAPHIC,
  },
  {
    id: "chicken-rice",
    label: "Chicken Rice",
    query: "Chicken Rice",
    dishId: "dish-chicken-rice",
    imageSource: POPULAR_CHICKEN_RICE_GRAPHIC,
  },
  {
    id: "char-kway-teow",
    label: "Char Kway Teow",
    query: "Char Kway Teow",
    imageSource: POPULAR_CHAR_KWAY_TEOW_GRAPHIC,
  },
  {
    id: "bak-chor-mee",
    label: "Bak Chor Mee",
    query: "Bak Chor Mee",
    imageSource: POPULAR_BAK_CHOR_MEE_GRAPHIC,
  },
  {
    id: "nasi-lemak",
    label: "Nasi Lemak",
    query: "Nasi Lemak",
    imageSource: require("../../assets/onboarding/food/nasi-lemak.webp"),
  },
  {
    id: "satay",
    label: "Satay",
    query: "Satay",
    imageSource: require("../../assets/onboarding/food/satay.webp"),
  },
  {
    id: "roti-prata",
    label: "Roti Prata",
    query: "Roti Prata",
    imageSource: require("../../assets/onboarding/food/roti-prata.webp"),
  },
  {
    id: "carrot-cake",
    label: "Carrot Cake",
    query: "Carrot Cake",
    imageSource: require("../../assets/onboarding/food/carrot-cake.webp"),
  },
  {
    id: "fish-soup",
    label: "Fish Soup",
    query: "Fish Soup",
    imageSource: require("../../assets/onboarding/food/fish-soup.webp"),
  },
  {
    id: "mee-siam",
    label: "Mee Siam",
    query: "Mee Siam",
    imageSource: require("../../assets/onboarding/food/mee-siam.webp"),
  },
  {
    id: "yong-tau-foo",
    label: "Yong Tau Foo",
    query: "Yong Tau Foo",
    imageSource: require("../../assets/onboarding/food/yong-tau-foo.webp"),
  },
  {
    id: "nasi-briyani",
    label: "Nasi Briyani",
    query: "Nasi Briyani",
    imageSource: require("../../assets/onboarding/food/nasi-briyani.webp"),
  },
  {
    id: "kaya-toast",
    label: "Kaya Toast",
    query: "Kaya Toast",
    imageSource: require("../../assets/onboarding/food/kaya-toast.webp"),
  },
  {
    id: "kueh-tutu",
    label: "Kueh Tutu",
    query: "Kueh Tutu",
    imageSource: require("../../assets/onboarding/food/kueh-tutu.webp"),
  },
] as const;
