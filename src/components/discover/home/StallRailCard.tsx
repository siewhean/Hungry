import { View } from "react-native";

import { StallLogoMark } from "@/components/stall/StallLogoMark";
import { AccessibleImage, AppSymbol, AppText, PressableScale } from "@/components/ui";
import { useHungryTheme } from "@/theme";

/** Height of the picture band at the top of a stall card. */
export const STALL_RAIL_IMAGE_HEIGHT = 156;

interface StallRailCardProps {
  name: string;
  /** A photo of the stall's food (or the stall); without one the logo sits on a soft band. */
  imageUrl?: string;
  logoUrl?: string;
  /** The top dish's rating; hidden while it has no reviews. */
  rating?: number;
  openLabel?: string;
  /** Building and unit, on a line of its own. */
  locationLabel?: string;
  /** A last line: "Be the first to review" (accent) or "Menu coming soon". */
  note?: { text: string; accent?: boolean };
  width: number;
  /** Closed stalls are dimmed, not hidden. */
  dimmed?: boolean;
  accessibilityLabel: string;
  onPress: () => void;
  onPressIn?: () => void;
}

/**
 * A stall in one of Home's sideways rails: a picture on top (the food, with the stall's logo
 * badge on it, or the logo alone when there is no photo) and the name, rating, opening line and
 * location underneath. Taller than the old logo-and-text row so the stall is easy to recognise.
 */
export function StallRailCard({
  name,
  imageUrl,
  logoUrl,
  rating,
  openLabel,
  locationLabel,
  note,
  width,
  dimmed = false,
  accessibilityLabel,
  onPress,
  onPressIn,
}: StallRailCardProps) {
  const { colorScheme, componentRadii, palette, radii, shadows, spacing } = useHungryTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={onPressIn}
      testID="stall-rail-card"
      style={[
        shadows.card,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: componentRadii.card,
          borderWidth: colorScheme === "dark" ? 0 : 1,
          opacity: dimmed ? 0.7 : 1,
          overflow: "hidden",
          width,
        },
      ]}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: palette.bgSoft,
          height: STALL_RAIL_IMAGE_HEIGHT,
          justifyContent: "center",
        }}
      >
        {imageUrl ? (
          <>
            <AccessibleImage
              source={{ uri: imageUrl }}
              style={{ height: STALL_RAIL_IMAGE_HEIGHT, width: "100%" }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
              decorative
            />
            <StallLogoMark
              borderWidth={2}
              logoUrl={logoUrl}
              name={name}
              size={40}
              style={{ bottom: spacing[2], left: spacing[2], position: "absolute" }}
            />
          </>
        ) : (
          <StallLogoMark borderWidth={3} logoUrl={logoUrl} name={name} size={72} />
        )}
      </View>
      <View style={{ gap: 1, paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
          <AppText
            variant="bodySmall"
            style={{ flexShrink: 1, fontWeight: "800" }}
            numberOfLines={1}
          >
            {name}
          </AppText>
          {rating !== undefined ? (
            <View
              accessibilityLabel={`Rated ${rating.toFixed(1)}`}
              style={{
                alignItems: "center",
                backgroundColor: palette.bgSoft,
                borderRadius: radii.pill,
                flexDirection: "row",
                flexShrink: 0,
                gap: 2,
                paddingHorizontal: spacing[2],
                paddingVertical: 2,
              }}
            >
              <AppSymbol name="rating" size={11} color={palette.starFill} />
              <AppText variant="micro">{rating.toFixed(1)}</AppText>
            </View>
          ) : null}
        </View>
        {openLabel ? (
          <AppText variant="micro" tone="secondary" numberOfLines={1}>
            {openLabel}
          </AppText>
        ) : null}
        {locationLabel ? (
          <AppText variant="micro" tone="secondary" numberOfLines={1}>
            {locationLabel}
          </AppText>
        ) : null}
        {note ? (
          <AppText variant="micro" tone={note.accent ? "accent" : "secondary"} numberOfLines={1}>
            {note.text}
          </AppText>
        ) : null}
      </View>
    </PressableScale>
  );
}
