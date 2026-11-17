import { View } from "react-native";

import {
  HUNGRY_LOGO_ICON,
  HUNGRY_LOGO_STANDARD_SIZE,
  HUNGRY_LOGO_TEXT,
} from "@/constants/brandAssets";
import { useHungryTheme } from "@/theme";
import { AccessibleImage } from "./AccessibleImage";

type HungryLogoProps = {
  size?: number;
  showWordmark?: boolean;
  wordmarkColor?: string;
  opacity?: number;
};

export function HungryLogo({
  size = HUNGRY_LOGO_STANDARD_SIZE,
  showWordmark = true,
  wordmarkColor,
  opacity = 1,
}: HungryLogoProps) {
  const { palette } = useHungryTheme();
  const markSize = showWordmark ? Math.round(size * 0.58) : size;
  const wordmarkHeight = Math.round(size * 0.26);
  const wordmarkWidth = Math.round(size * 1.28);
  const finalWordmarkColor = wordmarkColor ?? palette.orange;

  return (
    <View
      accessible
      accessibilityLabel="Hungry logo"
      accessibilityRole="image"
      style={{ alignItems: "center", gap: 8, opacity }}
    >
      <AccessibleImage
        source={HUNGRY_LOGO_ICON}
        contentFit="contain"
        decorative
        style={{ width: markSize, height: markSize }}
      />
      {showWordmark ? (
        <AccessibleImage
          source={HUNGRY_LOGO_TEXT}
          contentFit="contain"
          decorative
          style={{ width: wordmarkWidth, height: wordmarkHeight, tintColor: finalWordmarkColor }}
        />
      ) : null}
    </View>
  );
}
