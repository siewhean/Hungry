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
    imageSource: require("../../assets/discover/nasi-lemak-topdown.webp"),
  },
  {
    id: "satay",
    label: "Satay",
    query: "Satay",
    imageSource: require("../../assets/discover/satay-topdown.webp"),
  },
  {
    id: "roti-prata",
    label: "Roti Prata",
    query: "Roti Prata",
    imageSource: require("../../assets/discover/roti-prata-curry-topdown.webp"),
  },
  {
    id: "carrot-cake",
    label: "Carrot Cake",
    query: "Carrot Cake",
    imageSource: require("../../assets/discover/carrot-cake-black-topdown.webp"),
  },
  {
    id: "fish-soup",
    label: "Fish Soup",
    query: "Fish Soup",
    imageSource: require("../../assets/discover/fish-soup-topdown.webp"),
  },
  {
    id: "mee-siam",
    label: "Mee Siam",
    query: "Mee Siam",
    imageSource: require("../../assets/discover/mee-siam-topdown.webp"),
  },
  {
    id: "yong-tau-foo",
    label: "Yong Tau Foo",
    query: "Yong Tau Foo",
    imageSource: require("../../assets/discover/yong-tau-foo-topdown.webp"),
  },
  {
    id: "nasi-briyani",
    label: "Nasi Briyani",
    query: "Nasi Briyani",
    imageSource: require("../../assets/discover/chicken-biryani-topdown.webp"),
  },
  {
    id: "kaya-toast",
    label: "Kaya Toast",
    query: "Kaya Toast",
    imageSource: require("../../assets/discover/kaya-toast-topdown.webp"),
  },
  {
    id: "kueh-tutu",
    label: "Kueh Tutu",
    query: "Kueh Tutu",
    imageSource: require("../../assets/onboarding/food/kueh-tutu.webp"),
  },
  {
    id: "chilli-crab",
    label: "Chilli Crab",
    query: "Chilli Crab",
    imageSource: require("../../assets/discover/chilli-crab-topdown.webp"),
  },
  {
    id: "duck-rice",
    label: "Duck Rice",
    query: "Duck Rice",
    imageSource: require("../../assets/discover/duck-rice-topdown.webp"),
  },
  {
    id: "fishball-noodles",
    label: "Fishball Noodles",
    query: "Fishball Noodles",
    imageSource: require("../../assets/discover/fishball-noodles-topdown.webp"),
  },
  {
    id: "oyster-omelette",
    label: "Oyster Omelette",
    query: "Oyster Omelette",
    imageSource: require("../../assets/discover/oyster-omelette-topdown.webp"),
  },
  {
    id: "popiah",
    label: "Popiah",
    query: "Popiah",
    imageSource: require("../../assets/discover/popiah-topdown.webp"),
  },
  {
    id: "rojak",
    label: "Rojak",
    query: "Rojak",
    imageSource: require("../../assets/discover/rojak-topdown.webp"),
  },
  {
    id: "mee-rebus",
    label: "Mee Rebus",
    query: "Mee Rebus",
    imageSource: require("../../assets/discover/mee-rebus-topdown.webp"),
  },
  {
    id: "bee-hoon",
    label: "Bee Hoon",
    query: "Bee Hoon",
    imageSource: require("../../assets/discover/bee-hoon-topdown.webp"),
  },
  {
    id: "mala-xiang-guo",
    label: "Mala Xiang Guo",
    query: "Mala Xiang Guo",
    imageSource: require("../../assets/discover/mala-xiang-guo-topdown.webp"),
  },
  {
    id: "assam-pedas-fish",
    label: "Assam Pedas Fish",
    query: "Assam Pedas",
    imageSource: require("../../assets/discover/assam-pedas-fish-topdown.webp"),
  },
  {
    id: "sambal-stingray",
    label: "Sambal Stingray",
    query: "Stingray",
    imageSource: require("../../assets/discover/sambal-stingray-topdown.webp"),
  },
  {
    id: "har-cheong-gai",
    label: "Har Cheong Gai",
    query: "Har Cheong Gai",
    imageSource: require("../../assets/discover/har-cheong-gai-topdown.webp"),
  },
  {
    id: "spice-chicken-rice",
    label: "Chilli Chicken Rice",
    query: "Chicken Rice",
    imageSource: require("../../assets/discover/spice-chicken-rice-topdown.webp"),
  },
  {
    id: "chendol",
    label: "Chendol",
    query: "Chendol",
    imageSource: require("../../assets/discover/chendol-topdown.webp"),
  },
  {
    id: "ice-kacang",
    label: "Ice Kacang",
    query: "Ice Kacang",
    imageSource: require("../../assets/discover/ice-kacang-topdown.webp"),
  },
  {
    id: "goreng-pisang",
    label: "Goreng Pisang",
    query: "Goreng Pisang",
    imageSource: require("../../assets/discover/goreng-pisang-topdown.webp"),
  },
  {
    id: "orh-nee",
    label: "Orh Nee",
    query: "Orh Nee",
    imageSource: require("../../assets/discover/orh-nee-topdown.webp"),
  },
  {
    id: "tau-huay",
    label: "Tau Huay",
    query: "Tau Huay",
    imageSource: require("../../assets/discover/tau-huay-topdown.webp"),
  },
  {
    id: "kopi",
    label: "Kopi",
    query: "Kopi",
    imageSource: require("../../assets/discover/kopi-topdown.webp"),
  },
  {
    id: "teh-tarik",
    label: "Teh Tarik",
    query: "Teh Tarik",
    imageSource: require("../../assets/discover/teh-tarik-topdown.webp"),
  },
] as const;
