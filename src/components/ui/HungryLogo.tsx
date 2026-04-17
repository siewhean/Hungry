import { View } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

type HungryLogoProps = {
  size?: number;
  showWordmark?: boolean;
  wordmarkColor?: string;
};

export function HungryLogo({ size = 64, showWordmark = true, wordmarkColor }: HungryLogoProps) {
  const { palette } = useHungryTheme();
  const markSize = Math.max(24, Math.round(size * 0.58));
  const finalWordmarkColor = wordmarkColor ?? palette.orange;

  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <View
        style={{
          alignItems: "center",
          backgroundColor: palette.orangeLight,
          borderRadius: Math.round(markSize / 3),
          height: markSize,
          justifyContent: "center",
          width: markSize,
        }}
      >
        <AppText variant="h2" style={{ color: palette.orange, fontFamily: "Nunito_700Bold" }}>
          H
        </AppText>
      </View>
      {showWordmark ? (
        <AppText variant="h2" style={{ color: finalWordmarkColor, fontFamily: "Nunito_700Bold" }}>
          Hungry
        </AppText>
      ) : null}
    </View>
  );
}
