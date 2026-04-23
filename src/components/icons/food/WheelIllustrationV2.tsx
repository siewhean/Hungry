import React from "react";
import { View } from "react-native";
import Svg, { Path, Circle, G } from "react-native-svg";
import { useHungryTheme } from "@/theme";

interface IconProps {
  size?: number;
}

export function WheelIllustrationV2({ size = 120 }: IconProps) {
  const { palette } = useHungryTheme();

  return (
    <View style={{ width: size, height: size }}>
      <Svg width="100%" height="100%" viewBox="0 0 64 64">
        {/* Outer Ring */}
        <Circle
          cx="32"
          cy="32"
          r="28"
          fill={palette.bgSoft}
          stroke={palette.orange}
          strokeWidth="2"
        />

        {/* Wheel Segments */}
        <G transform="rotate(22.5 32 32)">
          <Path d="M32,32 L32,4 A28,28 0 0,1 51.8,11.2 Z" fill={palette.orange} opacity="0.1" />
          <Path d="M32,32 L51.8,11.2 A28,28 0 0,1 60,32 Z" fill={palette.orange} opacity="0.2" />
          <Path d="M32,32 L60,32 A28,28 0 0,1 51.8,52.8 Z" fill={palette.orange} opacity="0.3" />
        </G>

        {/* Center Pin */}
        <Circle cx="32" cy="32" r="4" fill={palette.text} />

        {/* Pointer */}
        <Path d="M32,2 L36,10 L28,10 Z" fill={palette.orange} />
      </Svg>
    </View>
  );
}
