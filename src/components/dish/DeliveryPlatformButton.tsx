import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { ExternalLink } from "lucide-react-native";

import { BRAND_COLORS, BRAND_BUTTON_TEXT_COLORS } from "@/constants/brandColors";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { openTrustedDeliveryUrl } from "@/lib/security/safeLinking";
import type { DeliveryLink } from "@/types/domain";
import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";
import { DeliveryBrandLogo, hasDeliveryBrandLogo } from "./DeliveryBrandLogo";

interface DeliveryPlatformButtonProps {
  link: DeliveryLink;
  compact?: boolean;
  dishId?: string;
  venueId?: string;
  style?: StyleProp<ViewStyle>;
}

// textColor keeps label contrast at 4.5:1 or better on each brand colour (white fails on
// Grab green and Deliveroo teal).
const platformMeta: Record<string, { label: string; color: string; textColor: string }> = {
  grabfood: {
    label: "Order on GrabFood",
    color: BRAND_COLORS.grab,
    textColor: BRAND_BUTTON_TEXT_COLORS.grab,
  },
  foodpanda: {
    label: "Order on Foodpanda",
    color: BRAND_COLORS.foodpanda,
    textColor: BRAND_BUTTON_TEXT_COLORS.foodpanda,
  },
  deliveroo: {
    label: "Order on Deliveroo",
    color: BRAND_COLORS.deliveroo,
    textColor: BRAND_BUTTON_TEXT_COLORS.deliveroo,
  },
};

export function DeliveryPlatformButton({
  link,
  compact = false,
  dishId,
  venueId,
  style,
}: DeliveryPlatformButtonProps) {
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const knownPlatform = platformMeta[link.platform];
  const meta = knownPlatform ?? {
    label: `Order on ${link.platform}`,
    color: palette.surface,
  };

  const handlePress = async () => {
    trackAnalyticsEvent("delivery_link_tapped", {
      dish_id: dishId,
      venue_id: venueId,
      platform: link.platform,
    });

    await openTrustedDeliveryUrl(link.platform, link.nativeUrl, link.webUrl);
  };

  if (compact && knownPlatform) {
    // The compact chip is a quiet outlined pill so delivery apps never outshout the page's own
    // actions: white fill, brand dot, plain label.
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={meta.label}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radii.pill,
            opacity: pressed ? 0.8 : 1,
            paddingHorizontal: spacing[3],
          },
        ]}
      >
        {hasDeliveryBrandLogo(link.platform) ? (
          <DeliveryBrandLogo platform={link.platform} color={meta.color} size={16} />
        ) : (
          <View style={[styles.dot, { backgroundColor: meta.color }]} />
        )}
        <AppText variant="bodySmallBold" numberOfLines={1}>
          {meta.label.replace("Order on ", "")}
        </AppText>
        <ExternalLink size={14} color={palette.textSecondary} />
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={meta.label}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        {
          ...shadows.card,
          backgroundColor: meta.color,
          borderRadius: radii.pill,
          justifyContent: "center",
          opacity: pressed ? 0.9 : 1,
          paddingHorizontal: spacing[3],
          paddingVertical: compact ? spacing[2] : spacing[3],
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {knownPlatform ? (
          <DeliveryBrandLogo platform={link.platform} color={knownPlatform.textColor} size={22} />
        ) : null}
        <AppText
          variant="bodyBold"
          tone={knownPlatform ? undefined : "default"}
          style={knownPlatform ? { color: knownPlatform.textColor } : undefined}
          numberOfLines={1}
        >
          {meta.label.replace("Order on ", "")}
        </AppText>
        <ExternalLink size={16} color={knownPlatform ? knownPlatform.textColor : palette.text} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
  },
  dot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  button: {
    minHeight: 52,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
});

/**
 * Delivery apps as big brand buttons across the page: two share the width, a single one takes
 * half of it (so it never reads as the page's main action).
 */
export function DeliveryButtonRow({
  links,
  dishId,
  venueId,
}: {
  links: DeliveryLink[];
  dishId?: string;
  venueId?: string;
}) {
  const { spacing } = useHungryTheme();
  if (links.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
      {links.map((link) => (
        <DeliveryPlatformButton
          key={`${link.platform}:${link.webUrl}`}
          link={link}
          dishId={dishId}
          venueId={venueId}
          style={links.length === 1 ? { width: "48%" } : { flexBasis: "45%", flexGrow: 1 }}
        />
      ))}
    </View>
  );
}
