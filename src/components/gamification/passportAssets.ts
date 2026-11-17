import type { ImageSourcePropType } from "react-native";

import type { PassportBadgeAssetKey, PassportStampAssetKey } from "@/types/domain";

export const PASSPORT_TEXTURE_ASSETS = {
  cover: require("../../assets/gamification/passport/passport-cover-orange.png"),
  paperSpread: require("../../assets/gamification/passport/passport-paper-spread.png"),
} satisfies Record<string, ImageSourcePropType>;

export const PASSPORT_STAMP_ASSETS: Record<PassportStampAssetKey, ImageSourcePropType> = {
  "stamp-cuisine-hawker": require("../../assets/gamification/passport/stamp-cuisine-hawker.png"),
  "stamp-classic-laksa": require("../../assets/gamification/passport/stamp-classic-laksa.png"),
  "stamp-hood-chinatown": require("../../assets/gamification/passport/stamp-hood-chinatown.png"),
  "stamp-dietary-halal": require("../../assets/gamification/passport/stamp-dietary-halal.png"),
};

export const PASSPORT_BADGE_ASSETS: Record<PassportBadgeAssetKey, ImageSourcePropType> = {
  "badge-hawker-explorer": require("../../assets/gamification/passport/badge-hawker-explorer.png"),
  "badge-classics-trail": require("../../assets/gamification/passport/badge-classics-trail.png"),
  "badge-night-makan": require("../../assets/gamification/passport/badge-night-makan.png"),
  "badge-contributor": require("../../assets/gamification/passport/badge-contributor.png"),
};
