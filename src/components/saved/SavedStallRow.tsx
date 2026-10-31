import { useState } from "react";
import { Pressable, View } from "react-native";

import { AccessibleImage, AppSymbol, AppText, PressableScale } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { VenueSummary } from "@/types/domain";

type Props = {
  venue: VenueSummary;
  /** "450m away" once the position and the stall's point are both known. */
  distanceLabel?: string;
  removing?: boolean;
  onOpen: () => void;
  onPressIn?: () => void;
  /** Absent on a row that cannot be un-saved from here. */
  onRemove?: () => void;
};

/** The stall's logo in a round tile, or the storefront mark when it has none. */
function StallLogo({ uri }: { uri?: string }) {
  const { palette } = useHungryTheme();
  const [failed, setFailed] = useState(false);
  return (
    <View
      testID="saved-stall-logo"
      style={{
        alignItems: "center",
        backgroundColor: palette.bgSoft,
        borderRadius: 28,
        height: 56,
        justifyContent: "center",
        overflow: "hidden",
        width: 56,
      }}
    >
      {uri && !failed ? (
        <AccessibleImage
          source={{ uri }}
          decorative
          style={{ height: 56, width: 56 }}
          contentFit="contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <AppSymbol name="stall" color={palette.textMuted} size={24} />
      )}
    </View>
  );
}

/** One saved stall: logo, name, where it is, how far, and whether it is open. */
export function SavedStallRow({
  venue,
  distanceLabel,
  removing = false,
  onOpen,
  onPressIn,
  onRemove,
}: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const place = [venue.unitNumber?.trim(), venue.buildingName].filter(Boolean).join(" · ");
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing[3],
        padding: spacing[2],
      }}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Open ${venue.name}`}
        onPress={onOpen}
        onPressIn={onPressIn}
        style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: spacing[3] }}
      >
        <StallLogo uri={venue.logoUrl} />
        <View style={{ flex: 1, gap: spacing[1] }}>
          <AppText variant="bodyBold" numberOfLines={2}>
            {venue.name}
          </AppText>
          {place ? (
            <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
              {place}
            </AppText>
          ) : null}
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
            <AppText
              variant="bodySmallBold"
              style={{ color: venue.isOpen ? palette.success : palette.textMuted }}
            >
              {venue.isOpen ? "Open now" : "Closed"}
            </AppText>
            {distanceLabel ? (
              <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
                <AppSymbol name="nearYou" color={palette.textSecondary} size={14} />
                <AppText variant="bodySmall" tone="secondary">
                  {distanceLabel}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      </PressableScale>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${venue.name} from Saved`}
          accessibilityState={{ busy: removing }}
          disabled={removing}
          hitSlop={6}
          onPress={onRemove}
          style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}
        >
          <AppSymbol name="saved" color={palette.orange} size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}
