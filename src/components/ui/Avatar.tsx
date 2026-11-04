import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";

import { useHungryTheme } from "@/theme";
import { AccessibleImage } from "./AccessibleImage";
import { AppText } from "./AppText";

const DEFAULT_USER_AVATAR = require("../../../assets/images/Logo/hungry_logo_icon_transparent.png");

interface AvatarProps {
  uri?: string;
  name: string;
  size?: number;
  variant?: "circle" | "square";
}

/** Up to two initials of a name ("Sarah Lim" is "SL"), or "HU" for an empty one. */
export function avatarInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "HU"
  );
}

export function Avatar({ uri, name, size = 40, variant = "circle" }: AvatarProps) {
  const { palette, radii } = useHungryTheme();
  // A photo that fails to load (offline, blocked host) shows initials, not a blank circle.
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => setLoadFailed(false), [uri]);

  const borderRadius = variant === "circle" ? size / 2 : radii.md;
  // Without a photo a named person gets their initials: the Hungry logo reads as an official account.
  const hasName = name.trim().length > 0;

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
      {(uri && loadFailed) || (!uri && hasName) ? (
        <AppText
          variant="bodyBold"
          numberOfLines={1}
          style={{ color: palette.orange, fontSize: Math.max(12, Math.round(size * 0.36)) }}
        >
          {avatarInitials(name)}
        </AppText>
      ) : uri ? (
        <AccessibleImage
          source={{ uri }}
          style={{ width: "100%", height: "100%", borderRadius }}
          contentFit="cover"
          onError={() => setLoadFailed(true)}
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
