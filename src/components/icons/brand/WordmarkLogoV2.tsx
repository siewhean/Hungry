import React from "react";
import { View } from "react-native";

import { AccessibleImage } from "@/components/ui/AccessibleImage";
import { HUNGRY_LOGO_TEXT } from "@/constants/brandAssets";
import { HUNGRY_LOGO_STANDARD_WORDMARK_SIZE } from "@/constants/brandAssets";

interface LogoProps {
  size?: number;
  color?: string;
}

export function WordmarkLogoV2({
  size = HUNGRY_LOGO_STANDARD_WORDMARK_SIZE,
  color: _color,
}: LogoProps) {
  const wordmarkHeight = Math.round(size * 0.26);

  return (
    <View
      accessible
      accessibilityLabel="Hungry logo"
      accessibilityRole="image"
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <AccessibleImage
        source={HUNGRY_LOGO_TEXT}
        contentFit="contain"
        decorative
        style={{ width: size, height: wordmarkHeight }}
      />
    </View>
  );
}
