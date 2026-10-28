import type { ImageSourcePropType } from "react-native";

/** Static requires so Metro bundles the pictures. One file per slug in tasteSliderStops.ts. */
export const TASTE_SLIDER_FOODS: Record<string, ImageSourcePropType> = {
  "fish-soup": require("../../assets/onboarding/sliders/fish-soup.webp"),
  "spice-chicken-rice": require("../../assets/onboarding/sliders/spice-chicken-rice.webp"),
  laksa: require("../../assets/onboarding/sliders/laksa.webp"),
  "sambal-stingray": require("../../assets/onboarding/sliders/sambal-stingray.webp"),
  "mala-xiang-guo": require("../../assets/onboarding/sliders/mala-xiang-guo.webp"),
  "roti-prata-curry": require("../../assets/onboarding/sliders/roti-prata-curry.webp"),
  "nasi-lemak": require("../../assets/onboarding/sliders/nasi-lemak.webp"),
  satay: require("../../assets/onboarding/sliders/satay.webp"),
  "teh-tarik": require("../../assets/onboarding/sliders/teh-tarik.webp"),
  "ice-kacang": require("../../assets/onboarding/sliders/ice-kacang.webp"),
  "kaya-toast": require("../../assets/onboarding/sliders/kaya-toast.webp"),
  popiah: require("../../assets/onboarding/sliders/popiah.webp"),
  "fishball-noodles": require("../../assets/onboarding/sliders/fishball-noodles.webp"),
  "duck-rice": require("../../assets/onboarding/sliders/duck-rice.webp"),
  "har-cheong-gai": require("../../assets/onboarding/sliders/har-cheong-gai.webp"),
  "carrot-cake-black": require("../../assets/onboarding/sliders/carrot-cake-black.webp"),
  "mee-rebus": require("../../assets/onboarding/sliders/mee-rebus.webp"),
  rojak: require("../../assets/onboarding/sliders/rojak.webp"),
  "mee-siam": require("../../assets/onboarding/sliders/mee-siam.webp"),
  "assam-pedas-fish": require("../../assets/onboarding/sliders/assam-pedas-fish.webp"),
  "yong-tau-foo": require("../../assets/onboarding/sliders/yong-tau-foo.webp"),
  "bee-hoon": require("../../assets/onboarding/sliders/bee-hoon.webp"),
  "chilli-crab": require("../../assets/onboarding/sliders/chilli-crab.webp"),
  "goreng-pisang": require("../../assets/onboarding/sliders/goreng-pisang.webp"),
  "oyster-omelette": require("../../assets/onboarding/sliders/oyster-omelette.webp"),
  "tau-huay": require("../../assets/onboarding/sliders/tau-huay.webp"),
  "orh-nee": require("../../assets/onboarding/sliders/orh-nee.webp"),
  chendol: require("../../assets/onboarding/sliders/chendol.webp"),
  kopi: require("../../assets/onboarding/sliders/kopi.webp"),
  "chicken-biryani": require("../../assets/onboarding/sliders/chicken-biryani.webp"),
};

export function tasteSliderFoodImage(slug: string): ImageSourcePropType | undefined {
  return TASTE_SLIDER_FOODS[slug];
}
