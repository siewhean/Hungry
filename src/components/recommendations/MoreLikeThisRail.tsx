import { ScrollView, View, type TextStyle } from "react-native";

import { AccessibleImage, AppText, PressableScale } from "@/components/ui";
import { formatDishPrice } from "@/features/detail/dishPrice";
import { formatAwayLabel } from "@/features/detail/similarDishes";
import { tapHaptic } from "@/lib/haptics";
import { sanitizeCatalogImageUrl } from "@/lib/services/catalog/media";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

const PRICE_FONT: TextStyle = { fontFamily: "Nunito_700Bold", fontVariant: ["tabular-nums"] };
const TILE_WIDTH = 168;

interface MoreLikeThisRailProps {
  title: string;
  /** One line under the title saying why these are here. */
  subtitle?: string;
  items: readonly DishDetail[];
  /** "dish": the dish leads, its stall underneath. "stall": the stall leads, "Try the <dish>". */
  mode: "dish" | "stall";
  venueNameOf: (dish: DishDetail) => string | undefined;
  onOpen: (dish: DishDetail, position: number) => void;
  testID?: string;
}

/** A sideways rail of dishes or stalls that taste like the one on screen. Hidden when empty. */
export function MoreLikeThisRail({
  title,
  subtitle,
  items,
  mode,
  venueNameOf,
  onOpen,
  testID,
}: MoreLikeThisRailProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  if (items.length === 0) return null;
  const hasPhotos = items.some((dish) => sanitizeCatalogImageUrl(dish.imageUrl));
  return (
    <View style={{ gap: spacing[3] }} testID={testID}>
      <View style={{ gap: spacing[1] }}>
        <AppText variant="h2" accessibilityRole="header" numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySmall" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -spacing[4] }}
        contentContainerStyle={{ gap: spacing[3], paddingHorizontal: spacing[4] }}
      >
        {items.map((dish, position) => {
          const venueName = venueNameOf(dish);
          const imageUrl = sanitizeCatalogImageUrl(dish.imageUrl);
          const heading = mode === "stall" ? (venueName ?? dish.name) : dish.name;
          const detail = mode === "stall" ? `Try the ${dish.name}` : venueName;
          const away = formatAwayLabel(dish.distanceMeters);
          const price = formatDishPrice(dish);
          const label = [`Open ${heading}`, detail, price, away].filter(Boolean).join(", ");
          return (
            <PressableScale
              key={dish.id}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => {
                tapHaptic();
                onOpen(dish, position);
              }}
              style={{
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: componentRadii.card,
                borderWidth: 1,
                overflow: "hidden",
                width: TILE_WIDTH,
              }}
            >
              {imageUrl ? (
                <AccessibleImage
                  source={{ uri: imageUrl }}
                  contentFit="cover"
                  style={{ width: "100%", height: TILE_WIDTH * 0.62 }}
                  decorative
                />
              ) : hasPhotos ? (
                <View
                  style={{
                    backgroundColor: palette.bgSoft,
                    height: TILE_WIDTH * 0.62,
                    width: "100%",
                  }}
                />
              ) : null}
              <View style={{ gap: spacing[1], padding: spacing[3] }}>
                <AppText variant="bodyBold" numberOfLines={1}>
                  {heading}
                </AppText>
                {detail ? (
                  <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                    {detail}
                  </AppText>
                ) : null}
                <View style={{ flexDirection: "row", gap: spacing[2] }}>
                  {price ? (
                    <AppText variant="price" style={[PRICE_FONT, { color: palette.text }]}>
                      {price}
                    </AppText>
                  ) : null}
                  {away ? (
                    <AppText variant="micro" tone="muted" style={{ alignSelf: "center" }}>
                      {away}
                    </AppText>
                  ) : null}
                </View>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}
