import { Image, View } from "react-native";

import { HUNGRY_LOGO_ICON } from "@/constants/brandAssets";
import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

type HungryLogoProps = {
  size?: number;
  showWordmark?: boolean;
  wordmarkColor?: string;
  opacity?: number;
};

export function HungryLogo({
  size = 64,
  showWordmark = true,
  wordmarkColor,
  opacity = 1,
}: HungryLogoProps) {
  const { palette } = useHungryTheme();
  const markSize = showWordmark ? Math.max(32, Math.round(size * 0.58)) : Math.max(18, size);
  const finalWordmarkColor = wordmarkColor ?? palette.orange;

  return (
    <View style={{ alignItems: "center", gap: 8, opacity }}>
      <Image
        source={HUNGRY_LOGO_ICON}
        resizeMode="contain"
        style={{ width: markSize, height: markSize }}
      />
      {showWordmark ? (
        <AppText variant="h2" style={{ color: finalWordmarkColor, fontFamily: "Nunito_700Bold" }}>
          Hungry
        </AppText>
      ) : null}
    </View>
  );
}
