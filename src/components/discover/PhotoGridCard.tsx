import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { AppSymbol, AppText, PressableScale } from "@/components/ui";
import { useHungryTheme } from "@/theme";

/** Every browse grid cell is this much taller than it is wide. */
export const PHOTO_GRID_CARD_RATIO = 1.35;

/** "486m", "1.2km"; nothing when there is no distance. */
export function formatPhotoGridDistance(meters?: number): string | undefined {
  if (meters === undefined) return undefined;
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.round(meters)}m`;
}

/**
 * The picture-led cell the Budget page uses, shared by every dish and stall grid: a full-bleed
 * photo, a chip on top (a stall's name on a dish, a place on a stall), and the name and
 * distance pinned to the bottom over a dark fade.
 */
export function PhotoGridCard({
  accessibilityLabel,
  badgeLabel,
  chipLabel,
  chipSymbol = "dish",
  children,
  distanceLabel,
  metaLeft,
  onPress,
  onPressIn,
  ratingLabel,
  reserveRight = 0,
  subtitle,
  testID,
  title,
  width,
}: {
  accessibilityLabel: string;
  /** A small pill under the chip, e.g. "Verified". */
  badgeLabel?: string;
  /** Shown in the chip on top; no chip when empty. */
  chipLabel?: string;
  chipSymbol?: "dish" | "nearYou";
  /** The photo layer. It fills the cell and sits behind the fade and the text. */
  children?: ReactNode;
  distanceLabel?: string;
  /** Replaces the distance on the bottom left, e.g. a price beside it. */
  metaLeft?: ReactNode;
  onPress: () => void;
  onPressIn?: () => void;
  ratingLabel?: string;
  /** Space kept free at the top right of the chip row, for a button laid over the photo. */
  reserveRight?: number;
  /** One line under the name, e.g. the dish that matched a search. */
  subtitle?: string;
  testID?: string;
  title: string;
  width: number;
}) {
  const { palette } = useHungryTheme();
  const height = width * PHOTO_GRID_CARD_RATIO;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={onPressIn}
      testID={testID}
      style={{
        backgroundColor: palette.surface,
        borderBottomWidth: 0.5,
        borderColor: palette.border,
        borderRightWidth: 0.5,
        height,
        width,
      }}
    >
      <View style={StyleSheet.absoluteFill}>{children}</View>
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", palette.mediaGradientMid, palette.detailImageOverlay]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.content}>
        {chipLabel ? (
          <View
            style={[
              styles.chip,
              { backgroundColor: palette.mediaScrimStrong, maxWidth: width - 16 - reserveRight },
            ]}
          >
            <AppSymbol name={chipSymbol} size={12} color={palette.white} />
            <AppText
              variant="micro"
              numberOfLines={1}
              style={{ color: palette.white, flexShrink: 1, fontWeight: "700" }}
            >
              {chipLabel}
            </AppText>
          </View>
        ) : null}
        {badgeLabel ? (
          <View style={[styles.badge, { backgroundColor: palette.surface }]}>
            <AppText variant="micro" style={{ color: palette.textSecondary }}>
              {badgeLabel}
            </AppText>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <AppText
          variant="bodySmallBold"
          style={{ color: palette.white, marginBottom: 2 }}
          numberOfLines={1}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText
            variant="micro"
            numberOfLines={1}
            style={{ color: palette.white, marginBottom: 2, opacity: 0.85 }}
          >
            {subtitle}
          </AppText>
        ) : null}
        <View style={styles.metaRow}>
          {metaLeft ??
            (distanceLabel ? (
              <View style={styles.inline}>
                <AppSymbol name="nearYou" size={10} color={palette.white} />
                <AppText variant="micro" style={{ color: palette.white, fontWeight: "600" }}>
                  {distanceLabel}
                </AppText>
              </View>
            ) : (
              <View />
            ))}
          {ratingLabel ? (
            <View style={styles.inline}>
              <AppSymbol name="rating" size={10} color={palette.white} />
              <AppText variant="micro" style={{ color: palette.white, fontWeight: "700" }}>
                {ratingLabel}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { ...StyleSheet.absoluteFill, justifyContent: "flex-end", padding: 10 },
  chip: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    left: 8,
    padding: 4,
    paddingRight: 8,
    position: "absolute",
    top: 8,
  },
  badge: {
    borderRadius: 10,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    position: "absolute",
    top: 42,
  },
  metaRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  inline: { alignItems: "center", flexDirection: "row", gap: 2 },
});
