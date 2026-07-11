import React from "react";
import { View } from "react-native";

import { AccessibleImage } from "@/components/ui/AccessibleImage";
import { HUNGRY_LOGO_ICON, HUNGRY_LOGO_TEXT } from "@/constants/brandAssets";
import { HUNGRY_LOGO_STANDARD_WORDMARK_SIZE } from "@/constants/brandAssets";
import { useHungryTheme } from "@/theme";

interface LogoProps {
  size?: number;
  color?: string;
  showWordmark?: boolean;
}

export function IconWordmarkLogoV2({
  size = HUNGRY_LOGO_STANDARD_WORDMARK_SIZE,
  color,
  showWordmark = true,
}: LogoProps) {
  const { palette, spacing } = useHungryTheme();
  const finalColor = color || palette.orange;
  const iconSize = showWordmark ? Math.round(size * 0.25) : size;
  const wordmarkWidth = Math.round(size * 0.95);
  const wordmarkHeight = Math.round(size * 0.26);

  return (
    <View
      accessible
      accessibilityLabel="Hungry logo"
      accessibilityRole="image"
      style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}
    >
      <View style={{ width: iconSize, height: iconSize }}>
        <AccessibleImage
          source={HUNGRY_LOGO_ICON}
          contentFit="contain"
          decorative
          style={{ width: iconSize, height: iconSize }}
        />
      </View>

      {showWordmark && (
        <AccessibleImage
          source={HUNGRY_LOGO_TEXT}
          contentFit="contain"
          decorative
          style={{ width: wordmarkWidth, height: wordmarkHeight, tintColor: finalColor }}
        />
      )}
    </View>
  );
}
