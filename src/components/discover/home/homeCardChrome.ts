import { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { useHungryTheme } from "@/theme";

/**
 * The frame and spacing of Home's dish cards and stall rows. The real cards and their loading
 * skeletons both take their styles from here, so the placeholder has the same border, radius,
 * padding and gaps as the card that replaces it.
 */
export function useDiscoverCardChrome() {
  const { colorScheme, componentRadii, palette, shadows, spacing } = useHungryTheme();
  return useMemo(() => {
    const frame = {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: componentRadii.card,
      borderWidth: colorScheme === "dark" ? 0 : 1,
    } satisfies ViewStyle;
    return {
      /** A dish card in a rail. */
      biteCardShell: (cardWidth: number): StyleProp<ViewStyle> => [
        shadows.card,
        { ...frame, overflow: "hidden", width: cardWidth },
      ],
      /** The text block under the photo. */
      biteCardBody: { gap: spacing[1], padding: spacing[3] } satisfies ViewStyle,
      /** The price (and rating) line at the foot of a dish card. */
      biteCardPriceRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: spacing[1],
      } satisfies ViewStyle,
      /** One stall in the "Stalls near you" list. */
      stallRowShell: [
        shadows.card,
        {
          ...frame,
          alignItems: "center",
          flexDirection: "row",
          gap: spacing[3],
          padding: spacing[3],
        },
      ] as StyleProp<ViewStyle>,
      /** The stall row's text column, between the logo and the chevron. */
      stallRowText: { flex: 1, gap: 2 } satisfies ViewStyle,
    };
  }, [colorScheme, componentRadii.card, palette.border, palette.surface, shadows.card, spacing]);
}
