import type { TextStyle } from "react-native";

/** Widens the tappable section titles (with a chevron) to a 44pt touch target. */
export const DISCOVER_TEXT_LINK_HIT_SLOP = { top: 16, bottom: 16, left: 12, right: 12 } as const;

export type DiscoverRailLayout = {
  cardWidth: number;
  contentGap: number;
  imageHeight: number;
  screenWidth: number;
};

export type DiscoverBiteCardVariant = "rating" | "topRated" | "price";

/** Prices in the body face with tabular figures, so a column of prices lines up and reads as text. */
export const HOME_PRICE_STYLE: Pick<TextStyle, "fontVariant"> = { fontVariant: ["tabular-nums"] };
