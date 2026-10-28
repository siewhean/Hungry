import type { ImageSourcePropType } from "react-native";

/** Placeholder until the mascot has a name: the lines read "Hi, I'm Hungry." */
export const MASCOT_NAME = "Hungry";

export const MASCOT_POSES = [
  "wave",
  "clipboard",
  "thinking",
  "sweating",
  "phone",
  "cooking",
  "celebrate",
  "heart",
] as const;
export type MascotPose = (typeof MASCOT_POSES)[number];

/**
 * The face the placeholder bowl pulls for each pose. When a real pose picture exists, add it to
 * MASCOT_POSE_IMAGES and the placeholder is not drawn for that pose.
 */
export const PLACEHOLDER_EXPRESSION: Record<MascotPose, "happy" | "hungry" | "thinking"> = {
  wave: "happy",
  clipboard: "happy",
  thinking: "thinking",
  sweating: "hungry",
  phone: "happy",
  cooking: "hungry",
  celebrate: "happy",
  heart: "happy",
};

/** Real mascot art by pose (transparent PNG, 1024 by 1024). Empty until the art arrives. */
export const MASCOT_POSE_IMAGES: Partial<Record<MascotPose, ImageSourcePropType>> = {};

/** The pose each numbered screen uses. */
export const POSE_FOR_SCREEN: Record<string, MascotPose> = {
  splash: "wave",
  name: "wave",
  location: "clipboard",
  areas: "clipboard",
  "meal-times": "clipboard",
  "palate-intro": "thinking",
  "taste-spicy": "sweating",
  "palate-reveal": "celebrate",
  dietary: "clipboard",
  "dish-grid": "clipboard",
  price: "clipboard",
  openness: "clipboard",
  swipe: "thinking",
  loading: "cooking",
  results: "celebrate",
  "meal-picks": "phone",
  account: "heart",
};

export function poseForScreen(screen: string): MascotPose {
  return POSE_FOR_SCREEN[screen] ?? "clipboard";
}
