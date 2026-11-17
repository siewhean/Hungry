import React from "react";
import { View } from "react-native";

import { AccessibleImage } from "@/components/ui/AccessibleImage";
import { HUNGRY_LOGO_ICON } from "@/constants/brandAssets";
import { HUNGRY_LOGO_STANDARD_WORDMARK_SIZE } from "@/constants/brandAssets";

interface LogoProps {
  size?: number;
  color?: string;
}

export function LogomarkLogoV2({
  size = HUNGRY_LOGO_STANDARD_WORDMARK_SIZE,
  color: _color,
}: LogoProps) {
  return (
    <View
      accessible
      accessibilityLabel="Hungry logo"
      accessibilityRole="image"
      style={{ width: size, height: size }}
    >
      <AccessibleImage
        source={HUNGRY_LOGO_ICON}
        contentFit="contain"
        decorative
        style={{ width: size, height: size }}
      />
    </View>
  );
}
