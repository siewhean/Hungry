import React from "react";
import { View } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useHungryTheme } from "@/theme";

interface IconProps {
  size?: number;
  color?: string;
}

export function RamenIconV2({ size = 24, color }: IconProps) {
  const { palette } = useHungryTheme();
  const finalColor = color || palette.text;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width="100%" height="100%" viewBox="0 0 24 24" fill="none">
        <Path
          d="M3 10c0 5 2 9 9 9s9-4 9-9"
          stroke={finalColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <Path
          d="M6 10c0 3 1.5 5 6 5s6-2 6-5"
          stroke={finalColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.6"
        />
        <Path d="M18 3l-6 10-6-10" stroke={finalColor} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    </View>
  );
}
