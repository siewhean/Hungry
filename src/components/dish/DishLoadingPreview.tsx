import { ActivityIndicator, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FloatingBackButton } from "@/components/detail/FloatingBackButton";
import { AccessibleImage, AppText } from "@/components/ui";
import { formatDishPrice } from "@/features/detail/dishPrice";
import type { DishPrefill } from "@/features/detail/dishPrefill";
import { useHungryTheme } from "@/theme";

type Props = {
  prefill: DishPrefill;
  onBack: () => void;
};

/**
 * The dish page before its first read lands, when the card that opened it already knew the
 * name, photo, price and stall: those paint at once and only the rest waits.
 */
export function DishLoadingPreview({ prefill, onBack }: Props) {
  const { palette, spacing } = useHungryTheme();
  const { width } = useWindowDimensions();
  const heroHeight = prefill.imageUrl ? Math.min(width * 0.62, 300) : 140;
  const price = formatDishPrice({
    price: prefill.price ?? 0,
    priceRange: prefill.priceRange ?? "",
  });

  return (
    <SafeAreaView style={{ backgroundColor: palette.bg, flex: 1 }} edges={["left", "right"]}>
      <FloatingBackButton onPress={onBack} />
      <View
        style={{ backgroundColor: palette.surfaceRaised, height: heroHeight, width }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {prefill.imageUrl ? (
          <AccessibleImage
            source={{ uri: prefill.imageUrl }}
            contentFit="cover"
            style={{ height: heroHeight, width }}
            decorative
          />
        ) : null}
      </View>
      <View style={{ gap: spacing[3], marginTop: spacing[4], paddingHorizontal: spacing[4] }}>
        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing[3] }}>
          <AppText variant="h1" style={{ flex: 1, fontSize: 28, lineHeight: 34 }}>
            {prefill.name}
          </AppText>
          {prefill.price ? (
            <AppText
              variant="price"
              style={{ color: palette.orange, fontSize: 24, lineHeight: 34 }}
            >
              {price}
            </AppText>
          ) : null}
        </View>
        {prefill.venueName ? (
          <AppText variant="bodyBold" tone="secondary" numberOfLines={1}>
            {prefill.venueName}
          </AppText>
        ) : null}
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
          <ActivityIndicator color={palette.orange} />
          <AppText variant="bodySmall" tone="secondary">
            Loading dish details...
          </AppText>
        </View>
      </View>
    </SafeAreaView>
  );
}
