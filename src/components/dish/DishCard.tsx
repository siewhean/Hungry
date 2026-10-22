import { Pressable, StyleSheet, View } from "react-native";
import { Heart } from "lucide-react-native";

import type { DishDetail } from "@/types/domain";
import { formatDishUpdated } from "@/features/detail/dishFreshness";
import { formatDishPrice } from "@/features/detail/dishPrice";
import { useHungryTheme, type HungryTheme } from "@/theme";
import { AccessibleImage, AppText, Badge, Card } from "../ui";
import { NoDishPhoto } from "./NoDishPhoto";

/** "Venue · #01-23 · L1", skipping empty parts so no stray separators show. */
export function formatDishLocation(
  dish: Pick<DishDetail, "venueName" | "unitNumber" | "floor">,
): string {
  return [dish.venueName, dish.unitNumber, dish.floor]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
}

interface DishCardProps {
  dish: DishDetail;
  variant?: "horizontal" | "vertical";
  favourited?: boolean;
  onPress?: () => void;
  onFavouritePress?: () => void;
  /**
   * "450m away" from the viewer (see formatDistanceFromUser). dishes.distance_meters is a
   * stored column, not the distance from the viewer, so without a label no distance shows.
   */
  distanceLabel?: string;
}

export function DishCard({
  dish,
  variant = "horizontal",
  favourited = false,
  onPress,
  onFavouritePress,
  distanceLabel,
}: DishCardProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const styles = createStyles(spacing);

  const isHorizontal = variant === "horizontal";
  const updatedLabel = formatDishUpdated(dish.updatedAt);
  const hasRating = dish.reviewCount > 0 && dish.rating > 0;
  const priceLabel = formatDishPrice(dish);
  const imageStyle = [
    styles.image,
    {
      backgroundColor: palette.bgSoft,
      borderRadius: radii.sm,
      height: isHorizontal ? 88 : 140,
      width: isHorizontal ? (88 as const) : ("100%" as const),
    },
  ];

  return (
    <Card
      style={[
        {
          padding: spacing[3],
        },
        ...(!isHorizontal ? [{ width: "100%" as const }] : []),
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[
          dish.name,
          priceLabel,
          hasRating ? `${dish.rating.toFixed(1)} stars` : "No ratings yet",
        ].join(", ")}
        onPress={onPress}
        style={({ pressed }) => [
          styles.content,
          {
            flexDirection: isHorizontal ? "row" : "column",
            gap: spacing[3],
            opacity: pressed ? 0.96 : 1,
          },
        ]}
      >
        {dish.imageUrl ? (
          <AccessibleImage
            source={{ uri: dish.imageUrl }}
            accessibilityLabel={`${dish.name} from ${dish.venueName}`}
            style={imageStyle}
            contentFit="cover"
            placeholder={dish.blurhash}
            transition={180}
          />
        ) : (
          <NoDishPhoto dishName={dish.name} style={imageStyle} />
        )}
        <View style={{ flex: 1, gap: spacing[2] }}>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: spacing[1] }}>
              <AppText variant="h3" numberOfLines={1}>
                {dish.name}
              </AppText>
              <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                {formatDishLocation(dish)}
              </AppText>
            </View>
            {onFavouritePress ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={favourited ? "Saved" : "Save"}
                accessibilityState={{ selected: favourited }}
                onPress={onFavouritePress}
                hitSlop={13}
              >
                <Heart
                  size={18}
                  color={favourited ? palette.error : palette.textMuted}
                  fill={favourited ? palette.error : "transparent"}
                />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.rowWrap}>
            <AppText variant="price">{priceLabel}</AppText>
            {hasRating ? <Badge label={`${dish.rating.toFixed(1)} ★`} tone="amber" /> : null}
            {distanceLabel ? (
              <AppText variant="bodySmall" tone="secondary">
                {distanceLabel}
              </AppText>
            ) : null}
            {updatedLabel ? (
              <AppText variant="bodySmall" tone="muted">
                {updatedLabel}
              </AppText>
            ) : null}
          </View>
          <View style={styles.chipRow}>
            {dish.tasteTags.slice(0, 3).map((tag) => (
              <Badge key={tag} label={tag} tone="neutral" />
            ))}
          </View>
        </View>
      </Pressable>
    </Card>
  );
}

const createStyles = (spacing: HungryTheme["spacing"]) =>
  StyleSheet.create({
    content: {
      alignItems: "flex-start",
    },
    image: {},
    row: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing[2],
      justifyContent: "space-between",
    },
    rowWrap: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing[2],
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing[1],
    },
  });
