import { StyleSheet, View, type ViewStyle } from "react-native";
import { Image } from "expo-image";

import { AppText } from "@/components/ui/AppText";
import { PASSPORT_BADGE_ASSETS } from "@/components/gamification/passportAssets";
import { useHungryTheme } from "@/theme";
import type { PassportBadgeDefinition } from "@/types/domain";

interface PassportBadgeImageProps {
  badge: PassportBadgeDefinition;
  earned?: boolean;
  size?: number;
  style?: ViewStyle;
}

export function PassportBadgeImage({
  badge,
  earned = false,
  size = 72,
  style,
}: PassportBadgeImageProps) {
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <View
      accessibilityLabel={`${badge.title} badge${earned ? " earned" : " locked"}`}
      accessibilityRole="image"
      style={[
        styles.wrap,
        {
          gap: spacing[1],
          minWidth: size + spacing[8],
          opacity: earned ? 1 : 0.42,
          width: size + spacing[8],
        },
        style,
      ]}
    >
      <View
        style={[
          styles.imageShell,
          {
            borderColor: earned ? palette.amber : palette.border,
            borderRadius: radii.pill,
            height: size,
            width: size,
          },
        ]}
      >
        <Image
          cachePolicy="memory-disk"
          contentFit="contain"
          source={PASSPORT_BADGE_ASSETS[badge.assetKey]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <AppText
        numberOfLines={2}
        variant="micro"
        style={[styles.label, { color: earned ? palette.text : palette.textMuted }]}
      >
        {badge.title}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  imageShell: {
    borderWidth: 1,
    overflow: "hidden",
  },
  label: {
    fontWeight: "800",
    textAlign: "center",
  },
  wrap: {
    alignItems: "center",
  },
});
