import React from "react";
import { View } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useHungryTheme } from "@/theme";

interface IconProps {
  size?: number;
}

export function BowlIllustrationV2({ size = 80 }: IconProps) {
  const { palette } = useHungryTheme();

  return (
    <View style={{ width: size, height: size }}>
      <Svg width="100%" height="100%" viewBox="0 0 64 64">
        {/* Bowl */}
        <Path d="M8,28 C8,48 16,56 32,56 C48,56 56,48 56,28 L8,28 Z" fill={palette.orange} />
        <Path d="M8,28 L56,28" stroke={palette.orangeDark} strokeWidth="2" />
        {/* Steam */}
        <Path
          d="M24,12 Q28,8 24,4 M32,16 Q36,12 32,8 M40,12 Q44,8 40,4"
          stroke={palette.orange}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
        />
      </Svg>
    </View>
  );
}
