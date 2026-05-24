import React from "react";
import { Image, View } from "react-native";

import { HUNGRY_LOGO_ICON } from "@/constants/brandAssets";
import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui";

interface LogoProps {
  size?: number;
  color?: string;
  showWordmark?: boolean;
}

export function IconWordmarkLogoV2({ size = 160, color, showWordmark = true }: LogoProps) {
  const { palette, spacing } = useHungryTheme();
  const finalColor = color || palette.orange;
  const iconSize = showWordmark ? size * 0.25 : size;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
      <View style={{ width: iconSize, height: iconSize }}>
        <Image
          source={HUNGRY_LOGO_ICON}
          resizeMode="contain"
          style={{ width: iconSize, height: iconSize }}
        />
      </View>

      {showWordmark && (
        <AppText
          variant="displaySm"
          style={{
            fontSize: size * 0.2,
            color: finalColor,
            fontFamily: "Fraunces_700Bold",
          }}
        >
          Hungry
        </AppText>
      )}
    </View>
  );
}
