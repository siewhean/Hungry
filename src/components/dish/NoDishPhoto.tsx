import { View, type StyleProp, type ViewStyle } from "react-native";
import { Utensils } from "lucide-react-native";

import { AccessibleImage, AppSymbol } from "@/components/ui";
import { useHungryTheme } from "@/theme";

interface NoDishPhotoProps {
  dishName: string;
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
  /**
   * Set on a stall's hero or card: draws the designed no-photo state (the stall's logo, or a fork
   * and knife, on a soft orange tint) instead of the quiet grey tile.
   */
  designed?: boolean;
  /** The stall's logo, shown in the designed state when it has one. */
  logoUrl?: string;
}

/** A quiet tinted tile: the icon stays small however large the empty photo area is. */
const MAX_ICON_SIZE = 24;
const LOGO_SIZE = 72;

/** Shown instead of a stock or placeholder image when a dish has no real photo yet. */
export function NoDishPhoto({
  dishName,
  style,
  iconSize = 28,
  designed = false,
  logoUrl,
}: NoDishPhotoProps) {
  const { palette } = useHungryTheme();
  if (designed) {
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={`${dishName}, no photo yet`}
        style={[
          { alignItems: "center", backgroundColor: palette.orangeLight, justifyContent: "center" },
          style,
        ]}
      >
        {logoUrl ? (
          <AccessibleImage
            source={{ uri: logoUrl }}
            decorative
            contentFit="contain"
            style={{ borderRadius: LOGO_SIZE / 2, height: LOGO_SIZE, width: LOGO_SIZE }}
            fallback={
              <AppSymbol name="noPhoto" color={palette.orange} size={Math.max(iconSize, 40)} />
            }
          />
        ) : (
          <AppSymbol name="noPhoto" color={palette.orange} size={Math.max(iconSize, 40)} />
        )}
      </View>
    );
  }
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${dishName}, no photo yet`}
      style={[
        { alignItems: "center", backgroundColor: palette.bgSoft, justifyContent: "center" },
        style,
      ]}
    >
      <Utensils color={palette.textMuted} size={Math.min(iconSize, MAX_ICON_SIZE)} />
    </View>
  );
}
