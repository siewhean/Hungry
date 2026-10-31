import { useState } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";
import { Heart, Utensils } from "lucide-react-native";

import { AccessibleImage, AppText, Card } from "@/components/ui";
import { formatDishPrice } from "@/features/detail/dishPrice";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { staggerDelay, usePressScale, useRiseIn } from "@/lib/motion/uiMotion";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";
import { cuisineImageKeyFor } from "./cuisineFallback";
import { ONBOARDING_FOOD_IMAGES } from "./onboardingFoodImages";

/**
 * A dish with no photo gets a tinted tile with its food type (laksa, rojak...), so a grid of
 * photo-less dishes still reads as a menu rather than as empty boxes. The catalog has few
 * dish photos today, so this is the usual case, not the exception.
 */
function CuisineTile({ dish, height }: { dish: DishDetail; height: number }) {
  const { palette, radii, spacing } = useHungryTheme();
  const exampleKey = cuisineImageKeyFor(dish);
  // The quiz's photo of the same kind of food: an example, labelled as one, never passed off as
  // the stall's own plate.
  if (exampleKey) {
    return (
      <View style={{ height, width: "100%" }}>
        <AccessibleImage
          source={ONBOARDING_FOOD_IMAGES[exampleKey]}
          contentFit="cover"
          style={{ height, width: "100%" }}
          accessibilityLabel={`Example photo of ${dish.foodTypeTag?.trim() || dish.name}, not this stall's own`}
        />
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            backgroundColor: palette.surface,
            borderRadius: radii.pill,
            bottom: spacing[1],
            left: spacing[1],
            opacity: 0.92,
            paddingHorizontal: spacing[2],
            paddingVertical: 2,
            position: "absolute",
          }}
        >
          <AppText variant="micro" tone="secondary">
            Example photo
          </AppText>
        </View>
      </View>
    );
  }
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
  /** Position in the grid: later cards enter a beat after earlier ones. */
  enterIndex?: number;
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
  enterIndex = 0,
}: ResultDishCardProps) {
  const { palette, radii, spacing, typography } = useHungryTheme();
  const reduceMotion = useReduceMotion();
  const enter = useRiseIn(reduceMotion, { delay: staggerDelay(enterIndex), distance: 8 });
  const press = usePressScale(reduceMotion);
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
        {/* Two lines: the dish name is the content, so it is not cut at the first line. */}
        <AppText
          variant="bodyBold"
          numberOfLines={2}
          style={{ minHeight: typography.bodyBold.lineHeight * 2 }}
        >
          {dish.name}
        </AppText>
        {details ? (
          <>
            <AppText variant="micro" tone="secondary" numberOfLines={1}>
              {dish.venueName}
            </AppText>
            {priceAndDistance ? (
              <AppText
                variant="micro"
                tone="secondary"
                numberOfLines={1}
                style={{ fontVariant: ["tabular-nums"] }}
              >
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
    // The outer view takes the row's height, so cards in a row stay the same height.
    <Animated.View style={[{ width: "48%" }, enter]}>
      <Animated.View style={[{ flex: 1 }, press.animatedStyle]}>
        <Card style={{ borderRadius: radii.md, flex: 1, overflow: "hidden", padding: 0 }}>
          {onOpen ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={openLabel}
              onPress={onOpen}
              onPressIn={press.onPressIn}
              onPressOut={press.onPressOut}
            >
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
            <Heart
              color={palette.orange}
              fill={isSaved ? palette.orange : "transparent"}
              size={18}
            />
          </Pressable>
        </Card>
      </Animated.View>
    </Animated.View>
  );
}
