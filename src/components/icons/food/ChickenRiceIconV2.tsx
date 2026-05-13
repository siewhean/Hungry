import React from "react";
import { View } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useHungryTheme } from "@/theme";

interface IconProps {
  size?: number;
  color?: string;
}

export function ChickenRiceIconV2({ size = 24, color }: IconProps) {
  const { palette } = useHungryTheme();
  const finalColor = color || palette.text;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width="100%" height="100%" viewBox="0 0 24 24" fill="none">
        {/* Chicken thigh shape */}
        <Path
          d="M12 4C8 4 5 7 5 11C5 15 8 18 12 18C16 18 19 15 19 11C19 7 16 4 12 4Z"
          stroke={finalColor}
          strokeWidth="2"
        />
        {/* Bone */}
        <Path d="M12 18V21" stroke={finalColor} strokeWidth="2" strokeLinecap="round" />
        {/* Cucumber slices */}
        <Circle cx="6" cy="18" r="2" stroke={finalColor} strokeWidth="1" opacity="0.5" />
        <Circle cx="18" cy="18" r="2" stroke={finalColor} strokeWidth="1" opacity="0.5" />
      </Svg>
    </View>
  );
}
