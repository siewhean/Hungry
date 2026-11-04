import { View } from "react-native";
import type { ColorValue } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useHungryTheme } from "@/theme";
import { NoPhotoSymbol } from "./dishSymbols";

type Props = {
  dishName: string;
  height: number;
};

/**
 * The dish page's hero when there is no photo to show: none were listed, or every one failed to
 * load (a dead link, a bad connection). It fills the hero's height so the page never opens on a
 * blank block, and carries the same fade into the page as a photo does.
 */
export function DishHeroPlaceholder({ dishName, height }: Props) {
  const { palette, spacing } = useHungryTheme();
  const colors: readonly [ColorValue, ColorValue, ColorValue] = [
    palette.detailHeroGradientStart,
    palette.detailHeroGradientMid,
    palette.bg,
  ];
  return (
    <View style={{ height, width: "100%" }}>
      <View
        accessibilityRole="image"
        accessibilityLabel={`${dishName} photo unavailable`}
        testID="dish-hero-placeholder"
        style={{
          alignItems: "center",
          backgroundColor: palette.surfaceRaised,
          flex: 1,
          justifyContent: "center",
          padding: spacing[6],
        }}
      >
        <NoPhotoSymbol color={palette.orange} size={48} />
      </View>
      <LinearGradient
        colors={colors}
        locations={[0, 0.58, 1]}
        style={{
          bottom: 0,
          height: height * 0.45,
          left: 0,
          position: "absolute",
          right: 0,
        }}
      />
    </View>
  );
}
