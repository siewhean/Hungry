import React from "react";
import { View } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useHungryTheme } from "@/theme";

interface LogoProps {
  size?: number;
  color?: string;
}

export function LogomarkLogoV2({ size = 80, color }: LogoProps) {
  const { palette } = useHungryTheme();
  const finalColor = color || palette.orange;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width="100%" height="100%" viewBox="0 0 32 32">
        {/* Abstract bowl + bite mark combo */}
        <Circle cx="16" cy="16" r="14" fill={finalColor} />
        <Circle cx="28" cy="8" r="6" fill={palette.bg} />
        <Circle cx="24" cy="4" r="4" fill={palette.bg} />

        {/* Stylized fork cut-out */}
        <Path
          d="M12,10 L12,18 M16,10 L16,22 M20,10 L20,18"
          stroke={palette.bg}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
