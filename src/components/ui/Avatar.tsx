import { View, StyleSheet } from "react-native";

import { useHungryTheme } from "@/theme";
import { AccessibleImage } from "./AccessibleImage";

const DEFAULT_USER_AVATAR = require("../../../assets/images/Logo/hungry_logo_icon_transparent.png");

interface AvatarProps {
  uri?: string;
  name: string;
  size?: number;
  variant?: "circle" | "square";
}

export function Avatar({ uri, name, size = 40, variant = "circle" }: AvatarProps) {
  const { palette, radii } = useHungryTheme();

  const borderRadius = variant === "circle" ? size / 2 : radii.md;

  return (
    <View
      accessible
      accessibilityLabel={`Avatar of ${name}`}
      accessibilityRole="image"
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: palette.bgSoft,
        },
      ]}
    >
      {uri ? (
        <AccessibleImage
          source={{ uri }}
          style={{ width: "100%", height: "100%", borderRadius }}
          contentFit="cover"
          decorative
        />
      ) : (
        <AccessibleImage
          source={DEFAULT_USER_AVATAR}
          style={{ width: "100%", height: "100%", borderRadius }}
          contentFit="contain"
          decorative
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
