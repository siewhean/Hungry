import { Star } from "lucide-react-native";
import { View } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";

export function MustOrderBadge() {
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <View
      style={{
        alignSelf: "flex-start",
        alignItems: "center",
        backgroundColor: palette.orangeLight,
        borderRadius: radii.pill,
        flexDirection: "row",
        gap: spacing[1],
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1],
      }}
    >
      <Star size={12} color={palette.orange} fill={palette.orange} />
      <AppText variant="micro" style={{ color: palette.orange, textTransform: "uppercase" }}>
        Must Order
      </AppText>
    </View>
  );
}

