import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

interface AvatarProps {
  uri?: string;
  name: string;
  size?: number;
  variant?: "circle" | "square";
}

export function Avatar({ uri, name, size = 40, variant = "circle" }: AvatarProps) {
  const { palette, radii } = useHungryTheme();
  
  const initials = name
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const borderRadius = variant === "circle" ? size / 2 : radii.md;

  return (
    <View
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
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%", borderRadius }}
          contentFit="cover"
        />
      ) : (
        <AppText
          style={{
            fontSize: size * 0.4,
            fontWeight: "700",
            color: palette.orange,
          }}
        >
          {initials}
        </AppText>
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
