import React from "react";
import { View } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useHungryTheme } from "@/theme";

interface MascotProps {
  size?: number;
  expression?: "happy" | "hungry" | "thinking";
}

export function MascotGraphicV2({ size = 120, expression = "happy" }: MascotProps) {
  const { palette } = useHungryTheme();

  return (
    <View style={{ width: size, height: size }}>
      <Svg width="100%" height="100%" viewBox="0 0 64 64">
        {/* Bowl Body */}
        <Path d="M8,32 C8,48 16,56 32,56 C48,56 56,48 56,32 L8,32 Z" fill={palette.orange} />

        {/* Chopsticks */}
        <Path
          d="M40,8 L24,30 M44,12 L28,34"
          stroke={palette.text}
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Eyes */}
        <Circle cx="24" cy="42" r="3" fill="white" />
        <Circle cx="40" cy="42" r="3" fill="white" />

        {/* Expression */}
        {expression === "happy" && (
          <Path
            d="M28,48 Q32,52 36,48"
            stroke="white"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        )}
        {expression === "hungry" && (
          <Path d="M28,48 L36,48 C36,48 36,54 32,54 C28,54 28,48 28,48 Z" fill="#FFBDBD" />
        )}
        {expression === "thinking" && (
          <Path d="M28,50 L36,50" stroke="white" strokeWidth="2" strokeLinecap="round" />
        )}
      </Svg>
    </View>
  );
}
