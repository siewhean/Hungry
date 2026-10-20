import { Pressable, View } from "react-native";

import { AppText, Badge, Button, Card } from "@/components/ui";
import { getPromotionPricing } from "@/features/merchant/merchantReadiness";
import { useHungryTheme } from "@/theme";
import type { MerchantPromotion } from "@/types/domain";

export function CustomerPromotionCard({
  promotion,
  ctaLabel,
  onPress,
}: {
  promotion: MerchantPromotion;
  ctaLabel?: string;
  onPress?: () => void;
}) {
  const { palette, spacing } = useHungryTheme();
  const pricing = getPromotionPricing(promotion);
  const discountLabel =
    typeof pricing.discountPercentage === "number" && pricing.discountPercentage > 0
      ? `${pricing.discountPercentage}% off`
      : undefined;

  const content = (
    <Card style={{ gap: spacing[3], padding: spacing[4] }}>
      <View style={{ alignItems: "flex-start", gap: spacing[2] }}>
        <Badge label="Promotion" tone="orange" />
        {discountLabel ? <Badge label={discountLabel} tone="amber" /> : null}
      </View>
      <View style={{ gap: spacing[1] }}>
        <AppText variant="bodyBold">{promotion.title}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {promotion.description}
        </AppText>
      </View>
      <View style={{ gap: spacing[1] }}>
        {typeof pricing.originalPrice === "number" &&
        typeof pricing.finalPrice === "number" &&
        pricing.finalPrice < pricing.originalPrice ? (
          <View style={{ alignItems: "baseline", flexDirection: "row", gap: spacing[2] }}>
            <AppText variant="price" tone="muted" style={{ textDecorationLine: "line-through" }}>
              S${pricing.originalPrice.toFixed(2)}
            </AppText>
            <AppText variant="price" style={{ color: palette.orange }}>
              S${pricing.finalPrice.toFixed(2)}
            </AppText>
          </View>
        ) : pricing.label ? (
          <AppText variant="price" style={{ color: palette.orange }}>
            {pricing.label}
          </AppText>
        ) : null}
      </View>
      {onPress && ctaLabel ? <Button label={ctaLabel} onPress={onPress} /> : null}
    </Card>
  );

  if (!onPress || ctaLabel) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open promotion ${promotion.title}`}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1 })}
    >
      {content}
    </Pressable>
  );
}
