import React from "react";
import { View } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useHungryTheme } from "@/theme";

interface IconProps {
  size?: number;
  color?: string;
}

export function LaksaIconV2({ size = 24, color }: IconProps) {
  const { palette } = useHungryTheme();
  const finalColor = color || palette.text;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width="100%" height="100%" viewBox="0 0 24 24" fill="none">
        {/* Bowl edge */}
        <Path d="M3 12C3 16 6 19 12 19S21 16 21 12H3Z" stroke={finalColor} strokeWidth="2" />
        {/* Noodles/Shrimp curve */}
        <Path
          d="M7 10C7 10 9 7 12 7S17 10 17 10"
          stroke={finalColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.7"
        />
        <Circle cx="12" cy="11" r="1.5" fill={finalColor} />
      </Svg>
    </View>
  );
}
