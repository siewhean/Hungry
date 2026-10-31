import { View, type StyleProp, type ViewStyle } from "react-native";
import { useHungryTheme } from "@/theme";
import { NoPhotoSymbol } from "./dishSymbols";

interface NoDishPhotoProps {
  dishName: string;
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
}

/** A quiet tinted tile: the icon stays small however large the empty photo area is. */
const MAX_ICON_SIZE = 24;

/** Shown instead of a stock or placeholder image when a dish has no real photo yet. */
export function NoDishPhoto({ dishName, style, iconSize = 28 }: NoDishPhotoProps) {
  const { palette } = useHungryTheme();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${dishName}, no photo yet`}
      style={[
        { alignItems: "center", backgroundColor: palette.bgSoft, justifyContent: "center" },
        style,
      ]}
    >
      <NoPhotoSymbol color={palette.textMuted} size={Math.min(iconSize, MAX_ICON_SIZE)} />
    </View>
  );
}
