import React from "react";
import { View } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
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
  const iconSize = size * 0.25;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
      <View style={{ width: iconSize, height: iconSize }}>
        <Svg width="100%" height="100%" viewBox="0 0 32 32">
          {/* Stylized bowl/vessel */}
          <Path d="M4,12 C4,12 4,28 16,28 C28,28 28,12 28,12 L4,12 Z" fill={finalColor} />
          <Path
            d="M10,8 L12,4 M16,8 L16,2 M22,8 L20,4"
            stroke={finalColor}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <Circle cx="16" cy="12" r="14" stroke={finalColor} strokeWidth="2" fill="none" />
        </Svg>
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
