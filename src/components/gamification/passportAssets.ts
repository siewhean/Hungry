import type { ImageSourcePropType } from "react-native";

import type { PassportBadgeAssetKey } from "@/types/domain";

export const PASSPORT_TEXTURE_ASSETS = {
  cover: require("../../assets/gamification/passport/passport-cover-orange.png"),
  paperSpread: require("../../assets/gamification/passport/passport-paper-spread.png"),
} satisfies Record<string, ImageSourcePropType>;

export const PASSPORT_BADGE_ASSETS: Record<PassportBadgeAssetKey, ImageSourcePropType> = {
  "badge-hawker-explorer": require("../../assets/gamification/passport/badge-hawker-explorer.png"),
  "badge-classics-trail": require("../../assets/gamification/passport/badge-classics-trail.png"),
  "badge-night-makan": require("../../assets/gamification/passport/badge-night-makan.png"),
  "badge-contributor": require("../../assets/gamification/passport/badge-contributor.png"),
};
