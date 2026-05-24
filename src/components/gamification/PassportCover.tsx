import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";

import { AppText } from "@/components/ui/AppText";
import { PASSPORT_TEXTURE_ASSETS } from "@/components/gamification/passportAssets";
import { useHungryTheme } from "@/theme";

interface PassportCoverProps {
  earnedStampCount: number;
  nextLabel?: string;
}

export function PassportCover({ earnedStampCount, nextLabel }: PassportCoverProps) {
  const { componentRadii, palette, spacing, shadows } = useHungryTheme();

  return (
    <View
      style={[
        shadows.card,
        styles.cover,
        {
          backgroundColor: palette.orange,
          borderColor: palette.orangeDark,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          padding: spacing[5],
        },
      ]}
    >
      <Image
        cachePolicy="memory-disk"
        contentFit="cover"
        source={PASSPORT_TEXTURE_ASSETS.cover}
        style={[StyleSheet.absoluteFill, styles.texture]}
      />
      <View
        style={[
          styles.spine,
          {
            backgroundColor: palette.orangeDark,
            bottom: spacing[4],
            left: spacing[4],
            top: spacing[4],
            width: spacing[1],
          },
        ]}
      />
      <View style={styles.header}>
        <View>
          <AppText variant="micro" style={[styles.inverse, { color: palette.textOnPrimary }]}>
            HUNGRY
          </AppText>
          <AppText variant="h2" style={[styles.inverse, { color: palette.textOnPrimary }]}>
            Passport
          </AppText>
        </View>
      </View>

      <View style={[styles.artRow, { marginTop: spacing[8] }]}>
        <View style={[styles.coverLines, { gap: spacing[1] }]}>
          <View style={[styles.coverLine, { backgroundColor: palette.orangeLight }]} />
          <View style={[styles.coverLineShort, { backgroundColor: palette.orangeLight }]} />
        </View>
      </View>

      <View style={[styles.footer, { gap: spacing[1] }]}>
        <AppText variant="bodySmallBold" style={[styles.inverse, { color: palette.textOnPrimary }]}>
          {earnedStampCount} {earnedStampCount === 1 ? "stamp" : "stamps"} collected
        </AppText>
        {nextLabel ? (
          <AppText variant="micro" style={[styles.inverse, { color: palette.textOnPrimary }]}>
            Next: {nextLabel}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  artRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  cover: {
    minHeight: 220,
    overflow: "hidden",
  },
  coverLine: {
    height: 3,
    width: 88,
  },
  coverLines: {
    alignItems: "flex-end",
    flex: 1,
  },
  coverLineShort: {
    height: 3,
    width: 56,
  },
  footer: {
    marginTop: "auto",
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  inverse: {
    fontWeight: "800",
  },
  spine: {
    position: "absolute",
  },
  texture: {
    opacity: 0.94,
  },
});
