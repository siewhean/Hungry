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

/**
 * Sizes the real Home cards and their loading skeletons both read, so a placeholder takes exactly
 * the room the card will: change one here and both move together.
 */
export const FOOD_STYLE_BOWL_SIZE = 72;
export const FOOD_STYLE_ITEM_WIDTH = 88;
/** The round stall logo at the start of a stall row. */
export const STALL_ROW_THUMBNAIL_SIZE = 56;
/** The chevron at the end of a stall row. */
export const STALL_ROW_CHEVRON_SIZE = 20;

/** The popular-food button: a bowl, then a label that always reserves two lines. */
export function getFoodStyleButtonMetrics(theme: {
  spacing: { 1: number; 1.5: number };
  typography: { bodySmallBold: { fontSize: number } };
}) {
  const bowlSize = FOOD_STYLE_BOWL_SIZE;
  const labelGap = theme.spacing[1.5];
  const labelLineHeight = theme.typography.bodySmallBold.fontSize + theme.spacing[1];
  return {
    bowlSize,
    labelGap,
    labelLineHeight,
    buttonHeight: bowlSize + labelGap + labelLineHeight * 2,
  };
}
