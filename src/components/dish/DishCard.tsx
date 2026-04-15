import { Pressable, StyleSheet, View } from "react-native";
import { Heart } from "lucide-react-native";
import { Image } from "expo-image";

import type { DishDetail } from "@/types/domain";
import { useHungryTheme } from "@/theme";
import { AppText, Badge, Card } from "../ui";

interface DishCardProps {
  dish: DishDetail;
  variant?: "horizontal" | "vertical";
  favourited?: boolean;
  onPress?: () => void;
  onFavouritePress?: () => void;
}

export function DishCard({ dish, variant = "horizontal", favourited = false, onPress, onFavouritePress }: DishCardProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const styles = createStyles(spacing);

  const isHorizontal = variant === "horizontal";

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
        accessibilityLabel={`${dish.name}, ${dish.priceRange}, ${dish.rating.toFixed(1)} stars`}
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
        <Image
          source={{ uri: dish.imageUrl }}
          style={[
            styles.image,
            {
              backgroundColor: palette.bgSoft,
              borderRadius: radii.sm,
              height: isHorizontal ? 88 : 140,
              width: isHorizontal ? 88 : "100%",
            },
          ]}
          contentFit="cover"
          placeholder={dish.blurhash}
          transition={180}
        />
        <View style={{ flex: 1, gap: spacing[2] }}>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: spacing[1] }}>
              <AppText variant="h3" numberOfLines={1}>
                {dish.name}
              </AppText>
              <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                {dish.venueName} · {dish.unitNumber} · {dish.floor}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={favourited ? "Remove from favourites" : "Add to favourites"}
              onPress={onFavouritePress}
              disabled={!onFavouritePress}
              hitSlop={8}
            >
              <Heart size={18} color={favourited ? palette.error : palette.textMuted} fill={favourited ? palette.error : "transparent"} />
            </Pressable>
          </View>
          <View style={styles.rowWrap}>
            <AppText variant="price">S${dish.price.toFixed(2)}</AppText>
            <Badge label={`${dish.rating.toFixed(1)} ★`} tone="amber" />
            <AppText variant="bodySmall" tone="secondary">
              {Math.round(dish.distanceMeters)} m away
            </AppText>
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

const createStyles = (spacing: any) => StyleSheet.create({
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
