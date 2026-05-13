import React from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui";

interface LogoProps {
  size?: number;
  color?: string;
}

export function WordmarkLogoV2({ size = 120, color }: LogoProps) {
  const { palette } = useHungryTheme();
  const finalColor = color || palette.orange;

  // Scale factor based on default width 120
  const scale = size / 120;

  return (
    <View style={{ position: "relative", alignItems: "center", justifyContent: "center" }}>
      <AppText
        variant="displayBold"
        style={{
          fontSize: 48 * scale,
          color: finalColor,
          fontFamily: "Fraunces_900Black",
        }}
      >
        Hungry
      </AppText>

      {/* Abstract bite mark overlay on the 'u' */}
      <View
        style={{
          position: "absolute",
          top: 8 * scale,
          left: 48 * scale,
          width: 24 * scale,
          height: 24 * scale,
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 24 24">
          <Path
            d="M20,4 C18,4 16,6 16,8 C16,10 18,12 20,12 C22,12 24,10 24,8 C24,6 22,4 20,4 Z"
            fill={palette.bg}
          />
          <Path
            d="M22,2 C20,2 18,4 18,6 C18,8 20,10 22,10 C24,10 26,8 26,6 C26,4 24,2 22,2 Z"
            fill={palette.bg}
          />
        </Svg>
      </View>
    </View>
  );
}
