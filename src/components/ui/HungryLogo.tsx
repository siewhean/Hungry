import { View } from "react-native";

import { AppText } from "./AppText";

type HungryLogoProps = {
  size?: number;
  showWordmark?: boolean;
  wordmarkColor?: string;
};

export function HungryLogo({
  size = 64,
  showWordmark = true,
  wordmarkColor = "#E8531E",
}: HungryLogoProps) {
  const markSize = Math.max(24, Math.round(size * 0.58));

  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <View
        style={{
          alignItems: "center",
          backgroundColor: "#FFF7EE",
          borderRadius: Math.round(markSize / 3),
          height: markSize,
          justifyContent: "center",
          width: markSize,
        }}
      >
        <AppText variant="h2" style={{ color: "#E8531E", fontFamily: "Nunito_700Bold" }}>
          H
        </AppText>
      </View>
      {showWordmark ? (
        <AppText variant="h2" style={{ color: wordmarkColor, fontFamily: "Nunito_700Bold" }}>
          Hungry
        </AppText>
      ) : null}
    </View>
  );
}
