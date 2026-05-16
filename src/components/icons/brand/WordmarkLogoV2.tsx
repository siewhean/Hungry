import React from "react";
import { Image, View } from "react-native";

import { HUNGRY_LOGO_ICON } from "@/constants/brandAssets";

interface LogoProps {
  size?: number;
  color?: string;
}

export function WordmarkLogoV2({ size = 120, color: _color }: LogoProps) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Image source={HUNGRY_LOGO_ICON} resizeMode="contain" style={{ width: size, height: size }} />
    </View>
  );
}
