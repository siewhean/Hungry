import { StyleSheet, View } from "react-native";

import { AccessibleImage } from "@/components/ui/AccessibleImage";
import { AppText } from "@/components/ui/AppText";
import { PASSPORT_STAMP_ASSETS } from "@/components/gamification/passportAssets";
import { useHungryTheme } from "@/theme";
import type { PassportStampDefinition } from "@/types/domain";

interface PassportStampBadgeProps {
  stamp: PassportStampDefinition;
  earned?: boolean;
  size?: "sm" | "md";
}

export function PassportStampBadge({
  stamp,
  earned = false,
  size = "md",
}: PassportStampBadgeProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const tone = getTone(stamp.inkTone, palette);
  const stampWidth = size === "sm" ? 76 : 124;
  const stampHeight = size === "sm" ? 52 : 78;

  return (
    <View
      accessibilityLabel={`${stamp.title} passport stamp`}
      style={[
        styles.badge,
        {
          backgroundColor: "transparent",
          height: stampHeight,
          opacity: earned ? 1 : 0.55,
          transform: stamp.stampShape === "slanted" ? [{ rotate: "-3deg" }] : undefined,
          width: stampWidth,
        },
      ]}
    >
      <AccessibleImage
        cachePolicy="memory-disk"
        contentFit="contain"
        decorative
        source={PASSPORT_STAMP_ASSETS[stamp.assetKey]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.thresholdPlate,
          {
            backgroundColor: earned ? tone.background : palette.surface,
            borderColor: earned ? tone.border : palette.border,
            borderRadius: componentRadii.button,
            bottom: size === "sm" ? 2 : spacing[1],
            paddingHorizontal: size === "sm" ? 5 : spacing[1.5],
            paddingVertical: size === "sm" ? 1 : spacing[0.5],
            right: size === "sm" ? 2 : spacing[1],
          },
        ]}
      >
        <AppText
          variant="micro"
          style={[styles.threshold, { color: earned ? tone.foreground : palette.textMuted }]}
        >
          {stamp.threshold}
        </AppText>
      </View>
    </View>
  );
}

function getTone(
  tone: PassportStampDefinition["inkTone"],
  palette: ReturnType<typeof useHungryTheme>["palette"],
) {
  if (tone === "amber") {
    return {
      background: palette.amberLight,
      border: palette.amber,
      foreground: palette.warningText,
    };
  }
  if (tone === "teal") {
    return { background: palette.infoSoft, border: palette.teal, foreground: palette.infoText };
  }
  if (tone === "navy") {
    return { background: palette.infoSoft, border: palette.navy, foreground: palette.infoText };
  }
  return {
    background: palette.orangeLight,
    border: palette.orange,
    foreground: palette.accentText,
  };
}

const styles = StyleSheet.create({
  badge: {
    overflow: "visible",
  },
  thresholdPlate: {
    borderWidth: 1,
    position: "absolute",
  },
  threshold: {
    fontWeight: "800",
  },
});
