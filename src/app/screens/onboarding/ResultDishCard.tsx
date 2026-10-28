import { useState } from "react";
import { Pressable, View } from "react-native";
import { Heart, Utensils } from "lucide-react-native";

import { AccessibleImage, AppText, Card } from "@/components/ui";
import { formatDishPrice } from "@/features/detail/dishPrice";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

/**
 * A dish with no photo gets a tinted tile with its food type (laksa, rojak...), so a grid of
 * photo-less dishes still reads as a menu rather than as empty boxes. The catalog has few
 * dish photos today, so this is the usual case, not the exception.
 */
function CuisineTile({ dish, height }: { dish: DishDetail; height: number }) {
  const { palette, spacing } = useHungryTheme();
  const caption = dish.foodTypeTag?.trim() || dish.tasteTags[0];
  const tints = [palette.orangeLight, palette.amberLight, palette.bgSoft];
  const tint = tints[[...dish.name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3];
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${dish.name}, no photo yet`}
      style={{
        alignItems: "center",
        backgroundColor: tint,
        gap: spacing[1],
        height,
        justifyContent: "center",
        padding: spacing[2],
        width: "100%",
      }}
    >
      <Utensils color={palette.textMuted} size={24} />
      {caption ? (
        <AppText variant="micro" tone="secondary" numberOfLines={1}>
          {caption}
        </AppText>
      ) : null}
    </View>
  );
}

/** The dish's own photo, or the cuisine tile when it has none or it fails to load. */
export function ResultDishPhoto({ dish, height }: { dish: DishDetail; height: number }) {
  const [failed, setFailed] = useState(false);
  if (!dish.imageUrl || failed) {
    return <CuisineTile dish={dish} height={height} />;
  }
  return (
    <AccessibleImage
      source={{ uri: dish.imageUrl }}
      contentFit="cover"
      style={{ height, width: "100%" }}
      accessibilityLabel={`Photo of ${dish.name}`}
      onError={() => setFailed(true)}
    />
  );
}

interface ResultDishCardProps {
  dish: DishDetail;
  /** Stall, price and distance (the payoff design) instead of the taste tags. */
  details: boolean;
  distanceLabel?: string;
  /** Added to fill the grid rather than ranked for this user's taste. */
  popular: boolean;
  isSaved: boolean;
  saveHint?: string;
  /** Opens the dish (signed in) or its preview (signed out); absent when the card is not tappable. */
  onOpen?: () => void;
  openLabel: string;
  onToggleSave: () => void;
}

export function ResultDishCard({
  dish,
  details,
  distanceLabel,
  popular,
  isSaved,
  saveHint,
  onOpen,
  openLabel,
  onToggleSave,
}: ResultDishCardProps) {
  const { palette, radii, spacing } = useHungryTheme();
  // An unknown price or distance is left out rather than shown as "Price not listed".
  const priceLabel = formatDishPrice(dish);
  const priceAndDistance = [
    priceLabel === "Price not listed" ? undefined : priceLabel,
    distanceLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  const body = (
    <>
      <ResultDishPhoto dish={dish} height={120} />
      <View style={{ gap: spacing[1], padding: spacing[2] }}>
        <AppText variant="bodyBold" numberOfLines={1}>
          {dish.name}
        </AppText>
        {details ? (
          <>
            <AppText variant="micro" tone="secondary" numberOfLines={1}>
              {dish.venueName}
            </AppText>
            {priceAndDistance ? (
              <AppText variant="micro" tone="secondary" numberOfLines={1}>
                {priceAndDistance}
              </AppText>
            ) : null}
          </>
        ) : (
          <AppText variant="micro" tone="secondary" numberOfLines={1}>
            {dish.tasteTags.slice(0, 2).join(" · ")}
          </AppText>
        )}
        {popular ? (
          <AppText variant="micro" numberOfLines={1} style={{ color: palette.orange }}>
            Popular on Hungry
          </AppText>
        ) : null}
      </View>
    </>
  );
  return (
    <Card style={{ borderRadius: radii.md, overflow: "hidden", padding: 0, width: "48%" }}>
      {onOpen ? (
        <Pressable accessibilityRole="button" accessibilityLabel={openLabel} onPress={onOpen}>
          {body}
        </Pressable>
      ) : (
        <View>{body}</View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${isSaved ? "Unsave" : "Save"} ${dish.name}`}
        accessibilityState={{ selected: isSaved }}
        accessibilityHint={saveHint}
        onPress={onToggleSave}
        style={{
          alignItems: "center",
          backgroundColor: palette.surface,
          borderRadius: radii.pill,
          height: 44,
          justifyContent: "center",
          opacity: 0.95,
          position: "absolute",
          right: spacing[1],
          top: spacing[1],
          width: 44,
        }}
      >
        <Heart color={palette.orange} fill={isSaved ? palette.orange : "transparent"} size={18} />
      </Pressable>
    </Card>
  );
}
