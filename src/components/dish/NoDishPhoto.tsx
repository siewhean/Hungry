import { View, type StyleProp, type ViewStyle } from "react-native";
import { Utensils } from "lucide-react-native";

import { useHungryTheme } from "@/theme";

interface NoDishPhotoProps {
  dishName: string;
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
}

/** Shown instead of a stock or placeholder image when a dish has no real photo yet. */
export function NoDishPhoto({ dishName, style, iconSize = 28 }: NoDishPhotoProps) {
  const { palette } = useHungryTheme();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${dishName}, no photo yet`}
      style={[
        { alignItems: "center", backgroundColor: palette.surfaceRaised, justifyContent: "center" },
        style,
      ]}
    >
      <Utensils color={palette.orange} size={iconSize} />
    </View>
  );
}
