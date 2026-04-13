import { Linking, Pressable, StyleSheet, View } from "react-native";
import { ExternalLink } from "lucide-react-native";

import { BRAND_COLORS } from "@/constants/brandColors";
import type { DeliveryLink } from "@/types/domain";
import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";

interface DeliveryPlatformButtonProps {
  link: DeliveryLink;
  compact?: boolean;
}

const platformMeta: Record<string, { label: string; color: string }> = {
  grabfood: { label: "Order on GrabFood", color: BRAND_COLORS.grab },
  foodpanda: { label: "Order on Foodpanda", color: BRAND_COLORS.foodpanda },
  deliveroo: { label: "Order on Deliveroo", color: BRAND_COLORS.deliveroo },
};

export function DeliveryPlatformButton({ link, compact = false }: DeliveryPlatformButtonProps) {
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const meta = platformMeta[link.platform] ?? { label: `Order on ${link.platform}`, color: palette.surface };

  const handlePress = async () => {
    try {
      await Linking.openURL(link.nativeUrl);
    } catch {
      await Linking.openURL(link.webUrl);
    }
  };

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
          opacity: pressed ? 0.9 : 1,
          paddingHorizontal: spacing[4],
          paddingVertical: compact ? spacing[2] : spacing[3],
        },
      ]}
    >
      <View style={styles.row}>
        <AppText 
          variant="body" 
          tone={platformMeta[link.platform] ? "inverse" : "default"} 
          numberOfLines={1}
        >
          {meta.label}
        </AppText>
        <ExternalLink size={16} color={platformMeta[link.platform] ? palette.white : palette.text} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
});

