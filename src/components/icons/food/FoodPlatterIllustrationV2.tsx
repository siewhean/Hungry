import React from "react";
import { View } from "react-native";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { useHungryTheme } from "@/theme";

interface IconProps {
  size?: number;
}

export function FoodPlatterIllustrationV2({ size = 100 }: IconProps) {
  const { palette } = useHungryTheme();

  return (
    <View style={{ width: size, height: size }}>
      <Svg width="100%" height="100%" viewBox="0 0 64 64">
        {/* Large Tray */}
        <Rect
          x="4"
          y="16"
          width="56"
          height="32"
          rx="4"
          fill={palette.bgSoft}
          stroke={palette.border}
          strokeWidth="2"
        />

        {/* Different food items on platter */}
        {/* Bowl */}
        <Circle cx="20" cy="32" r="10" fill={palette.orange} opacity="0.8" />
        {/* Plate */}
        <Rect x="36" y="24" width="18" height="16" rx="2" fill={palette.amber} opacity="0.6" />

        {/* Cutlery */}
        <Path
          d="M10,24 L10,40 M14,24 L14,40"
          stroke={palette.textMuted}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
